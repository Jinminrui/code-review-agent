import { z } from "zod";
import { phaseBudgetSchema } from "./review-runtime.js";

export const legacyReviewPlanSchema = z.object({
  riskPoints: z.array(
    z.object({
      area: z.string(),
      riskLevel: z.enum(["high", "medium", "low"]),
      reasoning: z.string()
    })
  ),
  reviewStrategy: z.string(),
  estimatedComplexity: z.enum(["low", "medium", "high"])
});

const currentReviewPlanObjectSchema = z.object({
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
      checks: z.array(
        z.object({
          id: z.string().min(1),
          description: z.string().min(1),
          completionCriteria: z.array(z.string().min(1)),
          allowedFiles: z.array(z.string().min(1)),
          evidenceTargets: z.array(z.string().min(1))
        })
      ),
      budget: phaseBudgetSchema
    })
  ),
  revision: z
    .object({
      reason: z.string().min(1),
      previousVersion: z.number().int().positive()
    })
    .optional(),
  // 迁移后的旧计划完整保存在独立命名空间，不混入新版全局计划字段。
  legacy: legacyReviewPlanSchema.optional()
});

const currentReviewPlanSchema = currentReviewPlanObjectSchema.superRefine((plan, context) => {
  if (plan.revision && plan.revision.previousVersion >= plan.version) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["revision", "previousVersion"],
      message: "previousVersion 必须小于当前计划 version"
    });
  }
});

export type LegacyReviewPlan = z.infer<typeof legacyReviewPlanSchema>;
export type ReviewPlan = z.infer<typeof currentReviewPlanSchema>;

export function migrateLegacyReviewPlan(legacyPlan: LegacyReviewPlan): ReviewPlan {
  return {
    version: 1,
    changeSetSummary: {
      files: [],
      totalInsertions: 0,
      totalDeletions: 0
    },
    riskAreas: legacyPlan.riskPoints.map((riskPoint, index) => ({
      id: `legacy-risk-${index + 1}`,
      area: riskPoint.area || `旧计划风险区域 ${index + 1}`,
      riskLevel: riskPoint.riskLevel,
      reasoning: riskPoint.reasoning || "旧计划未提供风险说明",
      relatedFiles: []
    })),
    units: [],
    legacy: legacyPlan
  };
}

const currentReviewPlanShapeKeys = [
  "version",
  "changeSetSummary",
  "riskAreas",
  "units",
  "revision",
  "legacy"
] as const;

function hasCurrentReviewPlanShape(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return currentReviewPlanShapeKeys.some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

export const reviewPlanSchema = z.preprocess((value) => {
  // 一旦出现新版专属字段，只按新版校验，禁止畸形新版静默回退到旧 schema。
  if (hasCurrentReviewPlanShape(value)) {
    return value;
  }

  const legacyPlan = legacyReviewPlanSchema.safeParse(value);
  return legacyPlan.success ? migrateLegacyReviewPlan(legacyPlan.data) : value;
}, currentReviewPlanSchema);

export function parseReviewPlan(value: unknown): ReviewPlan {
  return reviewPlanSchema.parse(value);
}

export const DEFAULT_REVIEW_PLAN: ReviewPlan = {
  version: 1,
  changeSetSummary: {
    files: [],
    totalInsertions: 0,
    totalDeletions: 0
  },
  riskAreas: [],
  units: []
};
