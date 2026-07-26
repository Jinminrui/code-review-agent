/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import type { LlmProvider } from "../domain/provider.js";
import {
  reflectionResultSchema,
  type ReflectionBackfillRequest,
  type ReflectionResult
} from "../domain/reflection-result.js";
import {
  evidenceBundleSchema,
  evidenceSourceSchema,
  type EvidenceBundle,
  type EvidenceItem,
  type EvidenceSource
} from "../domain/review-evidence.js";
import type { ReviewPlan } from "../domain/review-plan.js";
import type { ToolCall } from "../domain/tool.js";
import {
  requestReviewReflection,
  type ReflectionProviderErrorCode
} from "../infrastructure/llm/reflection-provider.js";
import type { PlanAuthorizer } from "../infrastructure/llm/plan-authorizer.js";
import {
  executeToolCall,
  type ToolExecutorContext
} from "../infrastructure/llm/tool-executors.js";

type ReviewUnit = ReviewPlan["units"][number];

export const MAX_REFLECTION_BACKFILL_TOOL_CALLS = 3;

export type ReviewReflectionStageBackfill = {
  requested: boolean;
  requestCount: number;
  toolCalls: number;
  requestDenied: boolean;
};

export type ReviewReflectionStageError = {
  code: "structured-output-unsupported" | ReflectionProviderErrorCode | "provider-failed" | "invalid-input";
  message: string;
};

export type ReviewReflectionStageResult =
  | {
      status: "completed" | "evidence-incomplete";
      reflectionResult: ReflectionResult;
      evidenceBundle: EvidenceBundle;
      backfill: ReviewReflectionStageBackfill;
      backfillError?: { code: string; message: string };
    }
  | {
      status: "reflection-failed";
      evidenceBundle: EvidenceBundle;
      backfill: ReviewReflectionStageBackfill;
      error: ReviewReflectionStageError;
    };

export type ReviewReflectionStageInput = {
  unit: ReviewUnit;
  evidenceBundle: EvidenceBundle;
  candidateContext: unknown;
  provider: Pick<LlmProvider, "id" | "capabilities" | "chat">;
  toolExecutorContext: ToolExecutorContext;
  authorizer?: PlanAuthorizer;
  authorizers?: ReadonlyMap<string, PlanAuthorizer>;
  signal?: AbortSignal;
};

const NO_BACKFILL: ReviewReflectionStageBackfill = {
  requested: false,
  requestCount: 0,
  toolCalls: 0,
  requestDenied: false
};

export async function runReviewReflectionStage(
  input: ReviewReflectionStageInput
): Promise<ReviewReflectionStageResult> {
  // Reflection 是“证据到 finding”的唯一决策入口；输入先过 schema，输出再经过
  // 确定性的文件、行号、证据引用、去重和状态校验。
  input.signal?.throwIfAborted();
  const parsedEvidenceResult = evidenceBundleSchema.safeParse(input.evidenceBundle);
  if (!parsedEvidenceResult.success) {
    return {
      status: "reflection-failed",
      evidenceBundle: emptyEvidenceBundle(input.unit.unitId),
      backfill: { ...NO_BACKFILL },
      error: {
        code: "invalid-input",
        message: `Reflection 输入 schema 校验失败：${parsedEvidenceResult.error.issues
          .map((issue) => `${issue.path.join(".") || "evidenceBundle"}: ${issue.message}`)
          .join("；")}`
      }
    };
  }
  const parsedEvidence = parsedEvidenceResult.data;

  if (input.provider.capabilities.structuredOutput !== true) {
    return {
      status: "reflection-failed",
      evidenceBundle: parsedEvidence,
      backfill: { ...NO_BACKFILL },
      error: {
        code: "structured-output-unsupported",
        message: "Reflection provider 不支持 structured output，禁止发布正式 finding"
      }
    };
  }

  // 每个 unit 最多一次补证请求，补证工具调用也有独立上限，避免模型无限追问。
  const firstRequest = await requestSafely(input, parsedEvidence);
  if ("error" in firstRequest) {
    return {
      status: "reflection-failed",
      evidenceBundle: parsedEvidence,
      backfill: { ...NO_BACKFILL },
      error: firstRequest.error
    };
  }

  const firstResult = normalizeCandidateEvidence(firstRequest.result, parsedEvidence);
  if (!firstResult.backfillRequest) {
    return {
      status: statusFromEvidence(parsedEvidence),
      reflectionResult: firstResult,
      evidenceBundle: parsedEvidence,
      backfill: { ...NO_BACKFILL }
    };
  }

  const backfill = await executeBackfill(input, parsedEvidence, firstResult.backfillRequest);
  if ("error" in backfill) {
    return {
      status: "evidence-incomplete",
      reflectionResult: firstResult,
      evidenceBundle: backfill.evidenceBundle,
      backfill: { requested: true, requestCount: 1, toolCalls: backfill.toolCalls, requestDenied: false },
      backfillError: backfill.error
    };
  }

  const secondRequest = await requestSafely(input, backfill.evidenceBundle);
  if ("error" in secondRequest) {
    return {
      status: "reflection-failed",
      evidenceBundle: backfill.evidenceBundle,
      backfill: { requested: true, requestCount: 1, toolCalls: backfill.toolCalls, requestDenied: false },
      error: secondRequest.error
    };
  }

  const secondResult = normalizeCandidateEvidence(secondRequest.result, backfill.evidenceBundle);
  if (secondResult.backfillRequest) {
    return {
      status: "evidence-incomplete",
      reflectionResult: secondResult,
      evidenceBundle: backfill.evidenceBundle,
      backfill: { requested: true, requestCount: 1, toolCalls: backfill.toolCalls, requestDenied: true },
      backfillError: {
        code: "second-backfill-request-denied",
        message: "文件级 Reflection 只允许一个 backfillRequest，第二次独立请求已拒绝"
      }
    };
  }

  return {
    status: statusFromEvidence(backfill.evidenceBundle),
    reflectionResult: secondResult,
    evidenceBundle: backfill.evidenceBundle,
    backfill: { requested: true, requestCount: 1, toolCalls: backfill.toolCalls, requestDenied: false }
  };
}

function emptyEvidenceBundle(unitId: string): EvidenceBundle {
  return {
    schemaVersion: 1,
    unitId: unitId.trim().length > 0 ? unitId : "invalid-unit",
    completeness: "incomplete",
    items: []
  };
}

async function requestSafely(
  input: ReviewReflectionStageInput,
  evidenceBundle: EvidenceBundle
): Promise<{ result: ReflectionResult } | { error: ReviewReflectionStageError }> {
  try {
    const result = await requestReviewReflection({
      provider: input.provider,
      unit: input.unit,
      evidenceBundle,
      candidateContext: input.candidateContext,
      signal: input.signal
    });
    return { result };
  } catch (error) {
    if (input.signal?.aborted) {
      throw input.signal.reason;
    }
    const providerError = error as { code?: unknown; message?: unknown };
    const code = isReflectionProviderErrorCode(providerError.code)
      ? providerError.code
      : "provider-failed";
    return {
      error: {
        code,
        message: error instanceof Error ? error.message : "Reflection provider 调用失败"
      }
    };
  }
}

async function executeBackfill(
  input: ReviewReflectionStageInput,
  evidenceBundle: EvidenceBundle,
  request: ReflectionBackfillRequest
): Promise<
  | { evidenceBundle: EvidenceBundle; toolCalls: number }
  | { error: { code: string; message: string }; evidenceBundle: EvidenceBundle; toolCalls: number }
> {
  const callSpecs = expandBackfillCalls(request);
  if ("error" in callSpecs) {
    return {
      error: callSpecs.error,
      evidenceBundle,
      toolCalls: 0
    };
  }

  const selectedAuthorizer = getAuthorizer(input, request.checkId);
  if (!selectedAuthorizer) {
    return {
      error: {
        code: "backfill-authorizer-missing",
        message: `检查项 ${request.checkId} 没有可复用的 PlanAuthorizer`
      },
      evidenceBundle,
      toolCalls: 0
    };
  }

  let currentEvidence = evidenceBundle;
  let toolCalls = 0;
  for (const [index, callSpec] of callSpecs.entries()) {
    const toolCall: ToolCall = {
      id: `reflection-backfill-${request.checkId}-${index + 1}`,
      checkId: request.checkId,
      name: callSpec.toolName,
      arguments: callSpec.arguments
    };
    const authorization = selectedAuthorizer.authorize(toolCall);
    if (authorization.decision === "deny") {
      return {
        error: {
          code: authorization.reason.code,
          message: authorization.reason.message
        },
        evidenceBundle: currentEvidence,
        toolCalls
      };
    }

    const toolResult = await executeToolCall(
      toolCall,
      { ...input.toolExecutorContext, signal: input.signal },
      authorization
    );
    input.signal?.throwIfAborted();
    selectedAuthorizer.recordResult(authorization, toolResult);
    const realExecution = !authorization.duplicate;
    if (realExecution) toolCalls += 1;

    if (toolResult.isError || !toolResult.contentHash) {
      return {
        error: {
          code: "backfill-tool-error",
          message: toolResult.content
        },
        evidenceBundle: currentEvidence,
        toolCalls
      };
    }

    if (!realExecution) continue;
    const item: EvidenceItem = {
      id: nextBackfillEvidenceId(currentEvidence),
      checkId: request.checkId,
      source: callSpec.toolName,
      arguments: toolResult.auditArguments ?? callSpec.arguments,
      content: toolResult.content,
      contentHash: toolResult.contentHash
    };
    const items = [...currentEvidence.items, item];
    currentEvidence = evidenceBundleSchema.parse({
      ...currentEvidence,
      items,
      completeness: hasAllChecks(input.unit, items) ? "complete" : "incomplete"
    });
  }

  return { evidenceBundle: currentEvidence, toolCalls };
}

type BackfillCallSpec = {
  toolName: EvidenceSource;
  arguments: Record<string, unknown>;
};

function expandBackfillCalls(
  request: ReflectionBackfillRequest
): BackfillCallSpec[] | { error: { code: string; message: string } } {
  const rawCalls = request.arguments.calls ?? request.arguments.toolCalls;
  if (rawCalls === undefined) {
    return [{ toolName: request.allowedTool, arguments: request.arguments }];
  }
  if (!Array.isArray(rawCalls) || rawCalls.length === 0) {
    return {
      error: { code: "invalid-backfill-calls", message: "backfillRequest.calls 必须是非空数组" }
    };
  }
  if (rawCalls.length > MAX_REFLECTION_BACKFILL_TOOL_CALLS) {
    return {
      error: {
        code: "backfill-tool-limit-exceeded",
        message: "单次 backfillRequest 最多允许三个工具调用"
      }
    };
  }

  const calls: BackfillCallSpec[] = [];
  for (const rawCall of rawCalls) {
    if (!rawCall || typeof rawCall !== "object" || Array.isArray(rawCall)) {
      return {
        error: { code: "invalid-backfill-calls", message: "backfillRequest.calls 包含无效工具调用" }
      };
    }
    const call = rawCall as Record<string, unknown>;
    const parsedToolName = evidenceSourceSchema.safeParse(
      call.allowedTool ?? call.name ?? call.tool ?? request.allowedTool
    );
    if (!parsedToolName.success) {
      return {
        error: { code: "invalid-backfill-tool", message: "补证工具不在只读工具白名单中" }
      };
    }
    const rawArguments = call.arguments ?? call.args;
    const callArguments = rawArguments && typeof rawArguments === "object" && !Array.isArray(rawArguments)
      ? rawArguments as Record<string, unknown>
      : Object.fromEntries(
          Object.entries(call).filter(([key]) =>
            !["allowedTool", "name", "tool", "arguments", "args", "checkId"].includes(key)
          )
        );
    calls.push({ toolName: parsedToolName.data, arguments: callArguments });
  }
  return calls;
}

function getAuthorizer(
  input: ReviewReflectionStageInput,
  checkId: string
): PlanAuthorizer | undefined {
  if (input.authorizer?.getCheckId() === checkId) return input.authorizer;
  const authorizer = input.authorizers?.get(checkId);
  return authorizer?.getCheckId() === checkId ? authorizer : undefined;
}

function hasAllChecks(unit: ReviewUnit, items: readonly EvidenceItem[]): boolean {
  if (unit.checks.length === 0) return false;
  const coveredChecks = new Set(items.map((item) => item.checkId));
  return unit.checks.every((check) => coveredChecks.has(check.id));
}

function nextBackfillEvidenceId(evidenceBundle: EvidenceBundle): string {
  const usedIds = new Set(evidenceBundle.items.map((item) => item.id));
  let index = 1;
  while (usedIds.has(`reflection-evidence-${index}`)) index += 1;
  return `reflection-evidence-${index}`;
}

function normalizeCandidateEvidence(
  result: ReflectionResult,
  evidenceBundle: EvidenceBundle
): ReflectionResult {
  const evidenceIds = new Set(evidenceBundle.items.map((item) => item.id));
  return reflectionResultSchema.parse({
    ...result,
    candidates: result.candidates.map((candidate) => {
      const hasOnlyExistingEvidence =
        candidate.evidenceIds.length > 0 &&
        candidate.evidenceIds.every((evidenceId) => evidenceIds.has(evidenceId));
      if (candidate.decision !== "accept" || hasOnlyExistingEvidence) return candidate;
      return {
        ...candidate,
        decision: "needs-review",
        decisionReason: `${candidate.decisionReason}；候选未引用全部有效证据，转入 needs-review`
      };
    })
  });
}

function statusFromEvidence(
  evidenceBundle: EvidenceBundle
): "completed" | "evidence-incomplete" {
  return evidenceBundle.completeness === "complete" ? "completed" : "evidence-incomplete";
}

function isReflectionProviderErrorCode(value: unknown): value is ReflectionProviderErrorCode {
  return value === "empty-response" ||
    value === "invalid-json" ||
    value === "invalid-result" ||
    value === "tool-request-denied";
}
