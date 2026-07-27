/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import type { ChatMessage, LlmProvider } from "../../domain/provider.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  reflectionResultSchema,
  type ReflectionResult
} from "../../domain/reflection-result.js";
import type { EvidenceBundle } from "../../domain/review-evidence.js";
import type { ReviewFinding } from "../../domain/review-finding.js";
import type { ReviewPlan } from "../../domain/review-plan.js";
import { logger } from "../logging/logger.js";

type ReviewUnit = ReviewPlan["units"][number];
const log = logger.child({ component: "reflection" });

export type ReflectionProviderErrorCode =
  | "empty-response"
  | "invalid-json"
  | "invalid-result"
  | "tool-request-denied";

export class ReflectionProviderError extends Error {
  constructor(
    readonly code: ReflectionProviderErrorCode,
    message: string,
    readonly details?: readonly string[],
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ReflectionProviderError";
  }
}

const REFLECTION_SYSTEM_PROMPT = [
  "你处于文件级 Reflection 阶段，只能根据给定子计划、证据包和候选上下文做语义判断。",
  "只调用 submit_review_reflection 工具提交结果，不要在普通文本中输出结果，也不要调用其他工具。",
  "工具调用参数必须是 JSON 对象，不是 JSON 字符串；字段必须使用原生类型，禁止把数字、数组或对象序列化成字符串。",
  "必须提交最小合法结果，例如 {\"schemaVersion\":1,\"unitId\":\"当前 unitId\",\"candidates\":[]}。",
  "schemaVersion 必须是数字 1，unitId 必须是当前输入中的 unitId，candidates 必须是数组；没有补证请求时省略 backfillRequest。",
  "候选 finding 必须引用 EvidenceBundle 中真实存在的 evidence id；证据不足时使用 needs-review。",
  "所有 finding 的 summary、explanation、evidence 和 suggestion 必须使用中文；文件路径、代码内容和内部 ID 保持原样。",
  "如确需补证，只能提出一个 backfillRequest；可在 arguments.calls 中列出最多三个只读工具调用。后续 Reflection 不得再次提出 backfillRequest，不得自行调用工具或扩大文件范围。",
  "不要输出原始思维链，只输出结构化结论、反例摘要和决策理由。"
].join("\n");

const GLOBAL_REFLECTION_SYSTEM_PROMPT = [
  "你处于全局 Reflection 阶段，只能消费给定的全局 ReviewPlan、文件级 Reflection 结果、正式 finding 和 Evidence 摘要。",
  "检查跨文件契约风险、重复或同根因 finding、互相矛盾的 finding，并统一整体 severity。",
  "schemaVersion 必须是数字 1，candidates 必须是数组；必须省略 unitId 和 backfillRequest。",
  "输出必须符合 ReflectionResult JSON contract；必须省略 unitId 和 backfillRequest。",
  "只能对输入正式 finding 做接受、拒绝、needs-review 或 severity 调整，不得新增 finding、修改文件/行号/问题范围，也不得引用 Evidence 摘要中不存在的 id。",
  "所有决策理由、反例摘要和 finding 文案必须使用中文；文件路径、代码内容和内部 ID 保持原样。",
  "本阶段没有工具，不得请求或调用工具。不要输出原始思维链，只输出结构化结论、反例摘要和决策理由。"
].join("\n");

export const reviewReflectionTool = {
  name: "submit_review_reflection" as const,
  description: "提交文件级 ReflectionResult。必须只提交一个完整结果。",
  parameters: zodToJsonSchema(reflectionResultSchema, {
    name: "review_reflection",
    target: "jsonSchema7",
    $refStrategy: "none"
  }) as Record<string, unknown>
};

export const globalReviewReflectionTool = {
  name: "submit_global_review_reflection" as const,
  description: "提交全局 ReflectionResult。不得新增 finding、调用工具或携带 unitId。",
  parameters: zodToJsonSchema(reflectionResultSchema.omit({ unitId: true, backfillRequest: true }), {
    name: "global_review_reflection",
    target: "jsonSchema7",
    $refStrategy: "none"
  }) as Record<string, unknown>
};

export type GlobalReflectionFileResult = {
  unitId: string;
  reflectionResult: ReflectionResult;
  findings: ReviewFinding[];
};

export type GlobalEvidenceSummary = {
  schemaVersion: EvidenceBundle["schemaVersion"];
  unitId: string;
  completeness: EvidenceBundle["completeness"];
  items: Array<{
    id: string;
    checkId: string;
    source: EvidenceBundle["items"][number]["source"];
    contentHash: string;
    summary: string;
  }>;
};

export function buildReviewReflectionMessages(input: {
  unit: ReviewUnit;
  evidenceBundle: EvidenceBundle;
  candidateContext: unknown;
}): ChatMessage[] {
  return [
    { role: "system", content: REFLECTION_SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        stage: "file-reflection",
        unit: input.unit,
        evidenceBundle: input.evidenceBundle,
        candidateContext: input.candidateContext
      })
    }
  ];
}

export function buildGlobalReviewReflectionMessages(input: {
  reviewPlan: ReviewPlan;
  fileResults: readonly GlobalReflectionFileResult[];
  evidenceSummaries: readonly GlobalEvidenceSummary[];
}): ChatMessage[] {
  return [
    { role: "system", content: GLOBAL_REFLECTION_SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        stage: "global-reflection",
        reviewPlan: input.reviewPlan,
        fileResults: input.fileResults,
        evidenceSummaries: input.evidenceSummaries
      })
    }
  ];
}

export async function requestReviewReflection(input: {
  provider: Pick<LlmProvider, "id" | "chat">;
  unit: ReviewUnit;
  evidenceBundle: EvidenceBundle;
  candidateContext: unknown;
  signal?: AbortSignal;
}): Promise<ReflectionResult> {
  let messages = buildReviewReflectionMessages(input);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    log.info({ stage: "file-reflection", providerId: input.provider.id, unitId: input.unit.unitId, attempt: attempt + 1 }, "Reflection 请求开始");
    try {
      const response = await input.provider.chat({
        messages,
        tools: [reviewReflectionTool],
        jsonMode: true,
        signal: input.signal
      });
      const result = parseReflectionResponse(response, reviewReflectionTool.name, "Reflection provider");
      if (result.unitId !== input.unit.unitId) {
        throw new ReflectionProviderError(
          "invalid-result",
          `ReflectionResult.unitId 必须等于当前文件子计划 ${input.unit.unitId}`,
          ["unitId: 与当前文件子计划不一致"]
        );
      }
      return result;
    } catch (error) {
      const retryable = error instanceof ReflectionProviderError && isRetryableReflectionError(error.code) && attempt === 0;
      log.warn({
        stage: "file-reflection",
        providerId: input.provider.id,
        unitId: input.unit.unitId,
        attempt: attempt + 1,
        retryable,
        ...(error instanceof ReflectionProviderError
          ? { code: error.code, details: error.details }
          : { code: "provider-error", details: [error instanceof Error ? error.message : "unknown error"] })
      }, retryable ? "Reflection 校验失败，将重试" : "Reflection 失败");
      if (!(error instanceof ReflectionProviderError) || attempt === 1 || !isRetryableReflectionError(error.code)) {
        throw error;
      }
      messages = [
        ...messages,
        {
          role: "user",
          content: `上一次 Reflection 工具参数未通过 schema 校验：${error.message}。请直接调用 ${reviewReflectionTool.name} 工具；参数必须是 JSON 对象，schemaVersion 使用数字 1，unitId 使用当前 unitId，candidates 使用数组，缺少候选时使用 []，不要输出普通文本。`
        }
      ];
    }
  }

  throw new Error("Reflection provider 重试流程异常结束");
}

function parseReflectionResponse(
  response: Awaited<ReturnType<LlmProvider["chat"]>>,
  expectedToolName: string,
  label: string
): ReflectionResult {
  const submitted = response.toolCalls.find((toolCall) => toolCall.name === expectedToolName);
  if (response.toolCalls.length > 0 && !submitted) {
    const isGlobalToolRequest = expectedToolName === globalReviewReflectionTool.name;
    throw new ReflectionProviderError(
      isGlobalToolRequest ? "tool-request-denied" : "invalid-result",
      isGlobalToolRequest
        ? "全局 Reflection 不允许调用工具，模型工具请求已拒绝"
        : `${label} 返回了非 ${expectedToolName} 工具调用`
    );
  }

  const value = submitted?.arguments ?? parseReflectionContent(response.content, label);
  const parsed = reflectionResultSchema.safeParse(value);
  if (!parsed.success) {
    const details = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "reflectionResult"}: ${issue.message}`
    );
    throw new ReflectionProviderError(
      "invalid-result",
      `${label} 结构化结果校验失败：${details.join("；")}`,
      details,
      { cause: parsed.error }
    );
  }

  return parsed.data;
}

function parseReflectionContent(content: string | null | undefined, label: string): unknown {
  if (content === null || content === undefined || content.trim().length === 0) {
    throw new ReflectionProviderError("empty-response", `${label} 未返回结构化结果`);
  }

  try {
    return JSON.parse(content);
  } catch (cause) {
    throw new ReflectionProviderError(
      "invalid-json",
      `${label} 返回了非法 JSON`,
      undefined,
      { cause }
    );
  }
}

function isRetryableReflectionError(code: ReflectionProviderErrorCode): boolean {
  return code === "invalid-result";
}

export async function requestGlobalReviewReflection(input: {
  provider: Pick<LlmProvider, "id" | "chat">;
  reviewPlan: ReviewPlan;
  fileResults: readonly GlobalReflectionFileResult[];
  evidenceSummaries: readonly GlobalEvidenceSummary[];
  signal?: AbortSignal;
}): Promise<ReflectionResult> {
  let messages = buildGlobalReviewReflectionMessages(input);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    log.info({ stage: "global-reflection", providerId: input.provider.id, attempt: attempt + 1, fileResultCount: input.fileResults.length }, "全局 Reflection 请求开始");
    try {
      const response = await input.provider.chat({
        messages,
        tools: [globalReviewReflectionTool],
        jsonMode: true,
        signal: input.signal
      });
      const result = parseReflectionResponse(response, globalReviewReflectionTool.name, "全局 Reflection provider");
      if (result.unitId !== undefined) {
        throw new ReflectionProviderError("invalid-result", "全局 ReflectionResult 必须省略 unitId", ["unitId: 全局 Reflection 不属于单个文件单元"]);
      }
      if (result.backfillRequest !== undefined) {
        throw new ReflectionProviderError("tool-request-denied", "全局 Reflection 不允许补证或调用工具，backfillRequest 已拒绝");
      }
      return result;
    } catch (error) {
      const retryable = error instanceof ReflectionProviderError && isRetryableReflectionError(error.code) && attempt === 0;
      log.warn({
        stage: "global-reflection",
        providerId: input.provider.id,
        attempt: attempt + 1,
        retryable,
        ...(error instanceof ReflectionProviderError
          ? { code: error.code, details: error.details }
          : { code: "provider-error", details: [error instanceof Error ? error.message : "unknown error"] })
      }, retryable ? "全局 Reflection 校验失败，将重试" : "全局 Reflection 失败");
      if (!(error instanceof ReflectionProviderError) || attempt === 1 || !isRetryableReflectionError(error.code)) {
        throw error;
      }
      messages = [
        ...messages,
        {
          role: "user",
          content: `上一次全局 Reflection 提交未通过 schema 校验：${error.message}。请补齐 candidates、schemaVersion，省略 unitId 和 backfillRequest，并调用 ${globalReviewReflectionTool.name} 工具提交结果。`
        }
      ];
    }
  }

  throw new Error("全局 Reflection provider 重试流程异常结束");
}
