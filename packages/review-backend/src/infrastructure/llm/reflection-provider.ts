import type { ChatMessage, LlmProvider } from "../../domain/provider.js";
import {
  reflectionResultSchema,
  type ReflectionResult
} from "../../domain/reflection-result.js";
import type { EvidenceBundle } from "../../domain/review-evidence.js";
import type { ReviewPlan } from "../../domain/review-plan.js";

type ReviewUnit = ReviewPlan["units"][number];

export type ReflectionProviderErrorCode =
  | "empty-response"
  | "invalid-json"
  | "invalid-result";

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
  "输出必须符合 ReflectionResult JSON contract，并保留 schemaVersion 和 unitId。",
  "候选 finding 必须引用 EvidenceBundle 中真实存在的 evidence id；证据不足时使用 needs-review。",
  "如确需补证，只能提出一个 backfillRequest；可在 arguments.calls 中列出最多三个只读工具调用。后续 Reflection 不得再次提出 backfillRequest，不得自行调用工具或扩大文件范围。",
  "不要输出原始思维链，只输出结构化结论、反例摘要和决策理由。"
].join("\n");

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

export async function requestReviewReflection(input: {
  provider: Pick<LlmProvider, "id" | "chat">;
  unit: ReviewUnit;
  evidenceBundle: EvidenceBundle;
  candidateContext: unknown;
  signal?: AbortSignal;
}): Promise<ReflectionResult> {
  const response = await input.provider.chat({
    messages: buildReviewReflectionMessages(input),
    jsonMode: true,
    signal: input.signal
  });

  if (response.content === null || response.content.trim().length === 0) {
    throw new ReflectionProviderError("empty-response", "Reflection provider 未返回 JSON 内容");
  }

  let value: unknown;
  try {
    value = JSON.parse(response.content);
  } catch (cause) {
    throw new ReflectionProviderError(
      "invalid-json",
      "Reflection provider 返回了非法 JSON",
      undefined,
      { cause }
    );
  }

  const parsed = reflectionResultSchema.safeParse(value);
  if (!parsed.success) {
    const details = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "reflectionResult"}: ${issue.message}`
    );
    throw new ReflectionProviderError(
      "invalid-result",
      `ReflectionResult 校验失败：${details.join("；")}`,
      details,
      { cause: parsed.error }
    );
  }

  if (parsed.data.unitId !== input.unit.unitId) {
    throw new ReflectionProviderError(
      "invalid-result",
      `ReflectionResult.unitId 必须等于当前文件子计划 ${input.unit.unitId}`,
      ["unitId: 与当前文件子计划不一致"]
    );
  }

  return parsed.data;
}
