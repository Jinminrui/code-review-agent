/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import type { ChatMessage, LlmProvider } from "../domain/provider.js";
import { evidenceBundleSchema, type EvidenceBundle, type EvidenceItem } from "../domain/review-evidence.js";
import type { ReviewPlan } from "../domain/review-plan.js";
import type {
  PlanAuthorizationReasonCode,
  PlanAuthorizationUsage,
  PlanAuthorizer
} from "../infrastructure/llm/plan-authorizer.js";
import type { ToolCall, ToolDefinition } from "../domain/tool.js";
import {
  executeToolCall,
  READ_ONLY_REVIEW_TOOL_DEFINITIONS,
  type ToolExecutorContext
} from "../infrastructure/llm/tool-executors.js";

type ReviewUnit = ReviewPlan["units"][number];

type RuntimeUsage = PlanAuthorizationUsage & { modelCalls: number };

export type ReviewReactStageUsage = Omit<
  PlanAuthorizationUsage,
  "inputTokens" | "outputTokens"
> & {
  inputTokens?: number;
  outputTokens?: number;
  usageUnavailable: boolean;
  modelCalls: number;
  durationMs: number;
};

export type ReviewReactStageStopReason =
  | {
      type: "authorization-denied";
      toolCallId: string;
      code: string;
      message: string;
    }
  | {
      type: "tool-error";
      toolCallId: string;
      message: string;
    }
  | {
      type: "budget-exhausted";
      budget:
        | "modelCalls"
        | "toolCalls"
        | "readBytes"
        | "inputTokens"
        | "outputTokens"
        | "durationMs";
    }
  | {
      type: "checks-incomplete";
      missingCheckIds: string[];
    }
  | {
      type: "usage-unavailable";
      budget: "inputTokens" | "outputTokens";
    };

export type ReviewReactStageResult = {
  status: "completed" | "evidence-incomplete";
  evidenceBundle: EvidenceBundle;
  usage: ReviewReactStageUsage;
  stopReason?: ReviewReactStageStopReason;
};

export type ReviewReactStageInput = {
  unit: ReviewUnit;
  authorizer?: PlanAuthorizer;
  authorizers?: ReadonlyMap<string, PlanAuthorizer>;
  provider: Pick<LlmProvider, "id" | "chat">;
  toolExecutorContext: ToolExecutorContext;
  signal?: AbortSignal;
};

const REACT_SYSTEM_PROMPT = [
  "你处于只读证据收集阶段。",
  "只能调用提供的四个只读工具，不得生成 ReviewFinding、代码评论或完成工具调用。",
  "证据充分后停止调用工具。"
].join("\n");

const REACT_TOOL_DEFINITIONS: ToolDefinition[] = READ_ONLY_REVIEW_TOOL_DEFINITIONS.map((tool) => ({
  ...tool,
  parameters: {
    ...tool.parameters,
    properties: {
      ...(tool.parameters.properties as Record<string, unknown> | undefined),
      checkId: {
        type: "string",
        description: "当前文件子计划中的检查项 ID"
      }
    },
    required: [...((tool.parameters.required as string[] | undefined) ?? []), "checkId"]
  }
}));

export async function runReviewReactStage(
  input: ReviewReactStageInput
): Promise<ReviewReactStageResult> {
  // ReAct 只收集证据，不生成 finding。模型可见的工具、文件范围和预算
  // 都由当前 unit 的 PlanAuthorizer 决定，防止执行阶段退化为任意代理。
  const startedAt = Date.now();
  const items: EvidenceItem[] = [];
  const usage: RuntimeUsage = {
    modelCalls: 0,
    toolCalls: 0,
    readBytes: 0,
    inputTokens: 0,
    outputTokens: 0
  };
  let usageUnavailable = false;
  const authorizers = buildAuthorizerMap(input);
  const checkIds = new Set(input.unit.checks.map((check) => check.id));
  const durationController = new AbortController();
  const durationReason = new DOMException("ReAct 阶段时长预算已耗尽", "TimeoutError");
  const finish = (
    status: ReviewReactStageResult["status"],
    stopReason?: ReviewReactStageStopReason
  ) => createResult(
    status,
    input,
    items,
    usage,
    startedAt,
    stopReason,
    usageUnavailable
  );

  input.signal?.throwIfAborted();
  if (input.unit.budget.maxDurationMs === 0) {
    return finish("evidence-incomplete", {
      type: "budget-exhausted",
      budget: "durationMs"
    });
  }

  const durationTimer = setTimeout(() => {
    durationController.abort(durationReason);
  }, input.unit.budget.maxDurationMs);
  const stageSignal = input.signal
    ? AbortSignal.any([input.signal, durationController.signal])
    : durationController.signal;

  try {
    // 每轮只发送当前 unit、已结构化的证据和工具结果，避免跨 unit 污染上下文。
    while (usage.modelCalls < input.unit.budget.modelCalls) {
      stageSignal.throwIfAborted();
      const response = await waitForAbortable(input.provider.chat({
        messages: buildMessages(input.unit, items),
        tools: REACT_TOOL_DEFINITIONS,
        signal: stageSignal
      }), stageSignal);
      stageSignal.throwIfAborted();
      usage.modelCalls += 1;

      if (response.usage) {
        usage.inputTokens += Math.max(0, response.usage.inputTokens);
        usage.outputTokens += Math.max(0, response.usage.outputTokens);
        if (!usageUnavailable) {
          const exhaustedTokenBudget = getExhaustedTokenBudget(usage, input.unit.budget);
          if (exhaustedTokenBudget) {
            return finish("evidence-incomplete", {
              type: "budget-exhausted",
              budget: exhaustedTokenBudget
            });
          }
        }
      } else {
        // 缺失 usage 只会使 token 成本不可计量，不能阻断授权工具执行。
        usageUnavailable = true;
      }

      if (Date.now() - startedAt >= input.unit.budget.maxDurationMs) {
        return finish("evidence-incomplete", {
          type: "budget-exhausted",
          budget: "durationMs"
        });
      }

      if (response.toolCalls.length === 0) {
        const missingCheckIds = getMissingCheckIds(input.unit, items);
        if (missingCheckIds.length > 0 || input.unit.checks.length === 0) {
          return finish("evidence-incomplete", {
            type: "checks-incomplete",
            missingCheckIds
          });
        }
        return usageUnavailable
          ? finish("completed", {
              type: "usage-unavailable",
              budget: "inputTokens"
            })
          : finish("completed");
      }

      // 一个响应可能包含多个工具调用；每个调用都单独做授权、去重和预算检查。
      for (const toolCall of response.toolCalls) {
        stageSignal.throwIfAborted();
        if (usage.toolCalls >= input.unit.budget.toolCalls) {
          return finish("evidence-incomplete", {
            type: "budget-exhausted",
            budget: "toolCalls"
          });
        }
        if (usage.readBytes >= input.unit.budget.maxReadBytes) {
          return finish("evidence-incomplete", {
            type: "budget-exhausted",
            budget: "readBytes"
          });
        }

        const requestedCheckId = getRequestedCheckId(toolCall);
        const selectedAuthorizer = requestedCheckId
          ? authorizers.get(requestedCheckId)
          : authorizers.size === 1
            ? [...authorizers.values()][0]
            : undefined;
        const selectedAuthorizerCheckId = selectedAuthorizer?.getCheckId();
        if (
          !selectedAuthorizer ||
          !selectedAuthorizerCheckId ||
          !checkIds.has(selectedAuthorizerCheckId) ||
          (requestedCheckId !== undefined && selectedAuthorizerCheckId !== requestedCheckId)
        ) {
          return finish("evidence-incomplete", {
            type: "authorization-denied",
            toolCallId: toolCall.id,
            code: "check-not-authorized",
            message: `检查项 ${String(requestedCheckId)} 不属于当前文件子计划`
          });
        }

        const executableToolCall = removeCheckId(toolCall);
        const authorization = selectedAuthorizer.authorize(executableToolCall);
        if (authorization.decision === "deny") {
          const exhaustedBudget = budgetFromReasonCode(authorization.reason.code);
          if (exhaustedBudget) {
            return finish("evidence-incomplete", {
              type: "budget-exhausted",
              budget: exhaustedBudget
            });
          }
          return finish("evidence-incomplete", {
            type: "authorization-denied",
            toolCallId: toolCall.id,
            code: authorization.reason.code,
            message: authorization.reason.message
          });
        }

        const toolResult = await waitForAbortable(executeToolCall(
          executableToolCall,
          { ...input.toolExecutorContext, signal: stageSignal },
          authorization
        ), stageSignal);
        stageSignal.throwIfAborted();
        selectedAuthorizer.recordResult(authorization, toolResult);
        if (!authorization.duplicate) {
          usage.toolCalls += 1;
          usage.readBytes += Buffer.byteLength(toolResult.content, "utf8");
        }

        if (toolResult.isError || !toolResult.contentHash) {
          return finish("evidence-incomplete", {
            type: "tool-error",
            toolCallId: toolCall.id,
            message: toolResult.content
          });
        }

        items.push({
          id: `evidence-${items.length + 1}`,
          checkId: authorization.checkId,
          source: authorization.toolName,
          arguments: toolResult.auditArguments ?? authorization.auditArguments,
          content: toolResult.content,
          contentHash: toolResult.contentHash
        });

        if (usage.readBytes >= input.unit.budget.maxReadBytes) {
          return finish("evidence-incomplete", {
            type: "budget-exhausted",
            budget: "readBytes"
          });
        }
      }
    }

    return finish("evidence-incomplete", {
      type: "budget-exhausted",
      budget: "modelCalls"
    });
  } catch (error) {
    // 外部取消必须继续抛出；只有内部 deadline 才降级为结构化预算耗尽。
    if (durationController.signal.aborted && !input.signal?.aborted) {
      return finish("evidence-incomplete", {
        type: "budget-exhausted",
        budget: "durationMs"
      });
    }
    throw error;
  } finally {
    clearTimeout(durationTimer);
  }
}

function getExhaustedTokenBudget(
  usage: PlanAuthorizationUsage,
  budget: ReviewUnit["budget"]
): "inputTokens" | "outputTokens" | undefined {
  if (usage.inputTokens >= budget.maxInputTokens) return "inputTokens";
  if (usage.outputTokens >= budget.maxOutputTokens) return "outputTokens";
  return undefined;
}

function waitForAbortable<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  signal.throwIfAborted();

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}

function buildAuthorizerMap(input: ReviewReactStageInput): ReadonlyMap<string, PlanAuthorizer> {
  const authorizers = new Map(input.authorizers ?? []);
  if (input.authorizer) {
    authorizers.set(input.authorizer.getCheckId(), input.authorizer);
  }
  if (authorizers.size === 0) {
    throw new Error("ReAct 阶段至少需要一个 PlanAuthorizer");
  }
  return authorizers;
}

function getRequestedCheckId(toolCall: ToolCall): string | undefined {
  if (toolCall.checkId) return toolCall.checkId;
  const checkId = toolCall.arguments.checkId;
  return typeof checkId === "string" ? checkId : undefined;
}

function removeCheckId(toolCall: ToolCall): ToolCall {
  if (!Object.prototype.hasOwnProperty.call(toolCall.arguments, "checkId")) {
    return toolCall;
  }
  const { checkId: _checkId, ...argumentsWithoutCheckId } = toolCall.arguments;
  return { ...toolCall, arguments: argumentsWithoutCheckId };
}

function getMissingCheckIds(unit: ReviewUnit, items: readonly EvidenceItem[]): string[] {
  const coveredCheckIds = new Set(items.map((item) => item.checkId));
  return unit.checks
    .map((check) => check.id)
    .filter((checkId) => !coveredCheckIds.has(checkId));
}

function budgetFromReasonCode(
  code: PlanAuthorizationReasonCode
): Extract<ReviewReactStageStopReason, { type: "budget-exhausted" }>["budget"] | undefined {
  const budgets: Partial<
    Record<
      PlanAuthorizationReasonCode,
      Extract<ReviewReactStageStopReason, { type: "budget-exhausted" }>["budget"]
    >
  > = {
    "tool-call-budget-exhausted": "toolCalls",
    "read-byte-budget-exhausted": "readBytes",
    "input-token-budget-exhausted": "inputTokens",
    "output-token-budget-exhausted": "outputTokens"
  };
  return budgets[code];
}

function buildMessages(unit: ReviewUnit, items: readonly EvidenceItem[]): ChatMessage[] {
  return [
    { role: "system", content: REACT_SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        stage: "react-evidence-collection",
        unit,
        toolResults: items.map((item) => ({
          evidenceId: item.id,
          checkId: item.checkId,
          source: item.source,
          arguments: item.arguments,
          contentSummary: summarizeContent(item.content),
          contentBytes: Buffer.byteLength(item.content, "utf8"),
          contentHash: item.contentHash
        }))
      })
    }
  ];
}

function summarizeContent(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 160 ? `${compact.slice(0, 160)}…` : compact;
}

function createResult(
  status: ReviewReactStageResult["status"],
  input: ReviewReactStageInput,
  items: EvidenceItem[],
  usage: RuntimeUsage,
  startedAt: number,
  stopReason: ReviewReactStageStopReason | undefined,
  usageUnavailable: boolean
): ReviewReactStageResult {
  const missingCheckIds = getMissingCheckIds(input.unit, items);
  const completeness =
    input.unit.checks.length > 0 && missingCheckIds.length === 0
      ? "complete"
      : "incomplete";
  const tokenUsage = usageUnavailable
    ? {}
    : { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens };
  return {
    status,
    evidenceBundle: evidenceBundleSchema.parse({
      schemaVersion: 1,
      unitId: input.unit.unitId,
      items,
      completeness
    }),
    usage: {
      modelCalls: usage.modelCalls,
      toolCalls: usage.toolCalls,
      readBytes: usage.readBytes,
      durationMs: Math.max(0, Date.now() - startedAt),
      usageUnavailable,
      ...tokenUsage
    },
    ...(stopReason ? { stopReason } : {})
  };
}
