/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { LlmProvider } from "../../domain/provider.js";
import { phaseBudgetSchema, type PhaseBudget } from "../../domain/review-runtime.js";
import type { ReviewPlan } from "../../domain/review-plan.js";
import type { ReviewPreAnalysis } from "../../application/review-pre-analysis.js";
import { buildReviewPlanMessages } from "./review-stage-prompts.js";

export const DEFAULT_PLAN_UNIT_BUDGET: Readonly<PhaseBudget> = {
  modelCalls: 2,
  toolCalls: 8,
  maxInputTokens: 12_000,
  maxOutputTokens: 4_000,
  maxReadBytes: 128_000,
  maxDurationMs: 120_000
};

const planCandidateSchema = z.object({
  version: z.number().int().positive(),
  changeSetSummary: z.object({
    files: z.array(z.string().min(1)),
    totalInsertions: z.number().int().nonnegative(),
    totalDeletions: z.number().int().nonnegative()
  }),
  riskAreas: z.array(
    z.object({
      id: z.string().min(1),
      area: z.string().min(1),
      riskLevel: z.enum(["high", "medium", "low"]),
      reasoning: z.string().min(1),
      relatedFiles: z.array(z.string().min(1))
    })
  ),
  units: z.array(
    z.object({
      unitId: z.string().min(1),
      file: z.string().min(1),
      order: z.number().int().nonnegative(),
      checks: z
        .array(
          z.object({
            id: z.string().min(1),
            description: z.string().min(1),
            completionCriteria: z.array(z.string().min(1)).min(1),
            allowedFiles: z.array(z.string().min(1)).min(1),
            evidenceTargets: z.array(z.string().min(1)).min(1)
          })
        )
        .min(1),
      budget: phaseBudgetSchema.default(DEFAULT_PLAN_UNIT_BUDGET)
    })
  ),
  revision: z
    .object({
      reason: z.string().min(1),
      previousVersion: z.number().int().positive()
    })
    .optional()
});

export const reviewPlanJsonSchema = {
  name: "review_plan",
  strict: true as const,
  schema: zodToJsonSchema(planCandidateSchema, {
    name: "review_plan",
    target: "openAi",
    $refStrategy: "none"
  }) as Record<string, unknown>
};

export type PlanProviderErrorCode = "empty-response" | "invalid-json" | "invalid-plan";

export class PlanProviderError extends Error {
  constructor(
    readonly code: PlanProviderErrorCode,
    message: string,
    readonly details?: readonly string[],
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "PlanProviderError";
  }
}

export async function requestReviewPlan(input: {
  provider: Pick<LlmProvider, "id" | "chat">;
  preAnalysis: ReviewPreAnalysis;
  diffSummary: string;
  allowedFiles: readonly string[];
  revision?: {
    currentPlan: ReviewPlan;
    trigger: { type: string; reason: string };
  };
  signal?: AbortSignal;
}): Promise<ReviewPlan> {
  let messages = buildReviewPlanMessages({
      preAnalysis: input.preAnalysis,
      diffSummary: input.diffSummary,
      allowedFiles: input.allowedFiles,
      ...(input.revision ? { revision: input.revision } : {})
    });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await input.provider.chat({ messages, jsonMode: true, jsonSchema: reviewPlanJsonSchema, signal: input.signal });
    try {
      return parsePlanResponse(response.content);
    } catch (error) {
      if (!(error instanceof PlanProviderError) || attempt === 1 || !isRetryablePlanError(error.code)) {
        throw error;
      }
      messages = [
        ...messages,
        {
          role: "user",
          content: `上一次 Plan 输出未通过 schema 校验：${error.message}。请修复所有字段类型和必填字段，只输出完整的 ReviewPlan JSON，不要输出解释。`
        }
      ];
    }
  }

  throw new Error("Plan provider 重试流程异常结束");
}

function parsePlanResponse(content: string | null | undefined): ReviewPlan {
  if (content === null || content === undefined || content.trim().length === 0) {
    throw new PlanProviderError("empty-response", "Plan provider 未返回 JSON 内容");
  }

  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch (cause) {
    throw new PlanProviderError("invalid-json", "Plan provider 返回了非法 JSON", undefined, {
      cause
    });
  }

  const parsed = planCandidateSchema.safeParse(value);
  if (!parsed.success) {
    const details = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "plan"}: ${issue.message}`
    );
    throw new PlanProviderError("invalid-plan", `ReviewPlan 校验失败：${details.join("；")}`, details, {
      cause: parsed.error
    });
  }

  return parsed.data;
}

function isRetryablePlanError(code: PlanProviderErrorCode): boolean {
  return code === "invalid-plan";
}
