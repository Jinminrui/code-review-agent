import { z } from "zod";

export const reviewPlanSchema = z.object({
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

export type ReviewPlan = z.infer<typeof reviewPlanSchema>;

export const DEFAULT_REVIEW_PLAN: ReviewPlan = {
  riskPoints: [],
  reviewStrategy: "Standard review: check for bugs, security issues, and code quality.",
  estimatedComplexity: "medium"
};
