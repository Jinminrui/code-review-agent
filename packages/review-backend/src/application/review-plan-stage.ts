/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { z } from "zod";
import type { LlmProvider } from "../domain/provider.js";
import { reviewPlanSchema, type ReviewPlan } from "../domain/review-plan.js";
import type { ReviewPreAnalysis } from "./review-pre-analysis.js";
import {
  DEFAULT_PLAN_UNIT_BUDGET,
  PlanProviderError,
  requestReviewPlan
} from "../infrastructure/llm/plan-provider.js";

const allowedRevisionTriggerTypes = [
  "file-missing",
  "dependency-disproven",
  "assumption-conflict"
] as const;

export const planRevisionTriggerSchema = z.object({
  type: z.enum(allowedRevisionTriggerTypes),
  reason: z.string().min(1)
});

export type PlanRevisionTrigger = z.infer<typeof planRevisionTriggerSchema>;

export const planStageErrorSchema = z.object({
  code: z.enum([
    "empty-response",
    "invalid-json",
    "invalid-plan",
    "provider-error",
    "file-out-of-scope",
    "unit-coverage-invalid",
    "revision-limit-exceeded",
    "revision-trigger-not-allowed",
    "revision-scope-expanded"
  ]),
  message: z.string().min(1),
  files: z.array(z.string().min(1)).optional(),
  details: z.array(z.string().min(1)).optional()
});

export type PlanStageError = z.infer<typeof planStageErrorSchema>;

export type ReviewPlanStageResult =
  | { status: "planned"; plan: ReviewPlan }
  | { status: "plan-degraded"; plan: ReviewPlan; error: PlanStageError }
  | { status: "revision-rejected"; plan: ReviewPlan; error: PlanStageError };

type BasePlanStageInput = {
  provider: Pick<LlmProvider, "id" | "chat">;
  preAnalysis: ReviewPreAnalysis;
  diffSummary: string;
  authorizedDependencyFiles?: readonly string[];
  signal?: AbortSignal;
};

type PlanValidationError = {
  code: "file-out-of-scope" | "unit-coverage-invalid";
  message: string;
  files: string[];
  details?: string[];
};

export async function generateReviewPlanStage(
  input: BasePlanStageInput
): Promise<ReviewPlanStageResult> {
  const changedFiles = getChangedFiles(input.preAnalysis);
  const allowedFiles = stableUnique([
    ...changedFiles,
    ...(input.authorizedDependencyFiles ?? [])
  ]);

  let validationFeedback: string | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const candidate = await requestReviewPlan({
        provider: input.provider,
        preAnalysis: input.preAnalysis,
        diffSummary: input.diffSummary,
        allowedFiles,
        ...(validationFeedback ? { validationFeedback } : {}),
        signal: input.signal
      });
      const normalized = normalizeAndValidatePlan(candidate, input.preAnalysis, allowedFiles, 1);

      if ("error" in normalized) {
        if (attempt === 0) {
          validationFeedback = formatPlanValidationFeedback(normalized.error);
          continue;
        }
        return degradedResult(input.preAnalysis, normalized.error);
      }

      return { status: "planned", plan: normalized.plan };
    } catch (error) {
      return degradedResult(input.preAnalysis, toPlanStageError(error));
    }
  }

  throw new Error("Plan stage 重试流程异常结束");
}

export async function reviseReviewPlanStage(
  input: BasePlanStageInput & {
    currentPlan: ReviewPlan;
    trigger: PlanRevisionTrigger;
  }
): Promise<ReviewPlanStageResult> {
  const parsedTrigger = planRevisionTriggerSchema.safeParse(input.trigger);
  if (!parsedTrigger.success) {
    return revisionRejected(input.currentPlan, {
      code: "revision-trigger-not-allowed",
      message: "计划修订触发原因不在允许范围内",
      details: parsedTrigger.error.issues.map((issue) => issue.message)
    });
  }

  if (input.currentPlan.version > 1 || input.currentPlan.revision) {
    return revisionRejected(input.currentPlan, {
      code: "revision-limit-exceeded",
      message: "计划版本已超过首次版本或已包含修订记录，不能再次修订"
    });
  }

  const changedFiles = getChangedFiles(input.preAnalysis);
  const revisionScope = stableUnique([
    ...changedFiles,
    ...(input.authorizedDependencyFiles ?? [])
  ]);
  const authoritativeFileSet = new Set(revisionScope);
  const currentPlanOutOfScopeFiles = collectReferencedFiles(input.currentPlan).filter(
    (file) => !authoritativeFileSet.has(file)
  );
  if (currentPlanOutOfScopeFiles.length > 0) {
    return revisionRejected(input.currentPlan, {
      code: "revision-scope-expanded",
      message: "当前计划引用了原始变更集或权威依赖范围外的文件",
      files: stableUnique(currentPlanOutOfScopeFiles)
    });
  }

  try {
    const candidate = await requestReviewPlan({
      provider: input.provider,
      preAnalysis: input.preAnalysis,
      diffSummary: input.diffSummary,
      allowedFiles: revisionScope,
      revision: {
        currentPlan: input.currentPlan,
        trigger: parsedTrigger.data
      },
      signal: input.signal
    });
    const normalized = normalizeAndValidatePlan(
      candidate,
      input.preAnalysis,
      revisionScope,
      input.currentPlan.version + 1,
      {
        reason: parsedTrigger.data.reason,
        previousVersion: input.currentPlan.version
      }
    );

    if ("error" in normalized) {
      const error: PlanStageError =
        normalized.error.code === "file-out-of-scope"
          ? {
              code: "revision-scope-expanded",
              message: "修订计划扩大了原始变更集或已授权依赖范围",
              files: normalized.error.files
            }
          : normalized.error;
      return revisionRejected(input.currentPlan, error);
    }

    return { status: "planned", plan: normalized.plan };
  } catch (error) {
    return revisionRejected(input.currentPlan, toPlanStageError(error));
  }
}

function normalizeAndValidatePlan(
  candidate: ReviewPlan,
  preAnalysis: ReviewPreAnalysis,
  allowedFiles: readonly string[],
  version: number,
  revision?: ReviewPlan["revision"]
): { plan: ReviewPlan } | { error: PlanValidationError } {
  const changedFiles = getChangedFiles(preAnalysis);
  const changedFileSet = new Set(changedFiles);
  const allowedFileSet = new Set(allowedFiles);
  const unitFiles = candidate.units.map((unit) => unit.file);
  const unexpectedUnitFiles = unitFiles.filter((file) => !changedFileSet.has(file));
  const missingUnitFiles = changedFiles.filter((file) => !unitFiles.includes(file));
  const duplicateUnitFiles = unitFiles.filter((file, index) => unitFiles.indexOf(file) !== index);

  if (unexpectedUnitFiles.length > 0 || missingUnitFiles.length > 0 || duplicateUnitFiles.length > 0) {
    const files = stableUnique([
      ...unexpectedUnitFiles,
      ...missingUnitFiles,
      ...duplicateUnitFiles
    ]);
    const details = [
      ...(missingUnitFiles.length > 0 ? [`缺失文件: ${missingUnitFiles.join(", ")}`] : []),
      ...(duplicateUnitFiles.length > 0 ? [`重复文件: ${stableUnique(duplicateUnitFiles).join(", ")}`] : []),
      ...(unexpectedUnitFiles.length > 0 ? [`越界文件: ${stableUnique(unexpectedUnitFiles).join(", ")}`] : [])
    ];
    return {
      error: {
        code: "unit-coverage-invalid",
        message: "文件子计划必须完整且唯一地覆盖原始变更集",
        files,
        details
      }
    };
  }

  const referencedFiles = collectReferencedFiles(candidate);
  const outOfScopeFiles = referencedFiles.filter((file) => !allowedFileSet.has(file));
  if (outOfScopeFiles.length > 0) {
    return {
      error: {
        code: "file-out-of-scope",
        message: "计划引用了不存在或未授权的文件",
        files: stableUnique(outOfScopeFiles),
        details: [`越界文件: ${stableUnique(outOfScopeFiles).join(", ")}`]
      }
    };
  }

  const units = [...candidate.units]
    .sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }
      if (left.file !== right.file) {
        return left.file < right.file ? -1 : 1;
      }
      return left.unitId < right.unitId ? -1 : left.unitId > right.unitId ? 1 : 0;
    })
    .map((unit, order) => ({ ...unit, order }));

  const plan = reviewPlanSchema.parse({
    version,
    changeSetSummary: {
      files: changedFiles,
      totalInsertions: preAnalysis.totals.insertions,
      totalDeletions: preAnalysis.totals.deletions
    },
    riskAreas: candidate.riskAreas,
    units,
    ...(revision ? { revision } : {})
  });

  return { plan };
}

export function buildDeterministicReviewPlan(preAnalysis: ReviewPreAnalysis): ReviewPlan {
  const changedFiles = getChangedFiles(preAnalysis);

  return reviewPlanSchema.parse({
    version: 1,
    changeSetSummary: {
      files: changedFiles,
      totalInsertions: preAnalysis.totals.insertions,
      totalDeletions: preAnalysis.totals.deletions
    },
    riskAreas: preAnalysis.sensitivePathHints.map((hint, index) => ({
      id: `fallback-risk-${index + 1}`,
      area: `敏感路径：${hint.categories.join("、")}`,
      riskLevel: "medium" as const,
      reasoning: "确定性预分析识别到敏感路径，需要基础审查",
      relatedFiles: [hint.path]
    })),
    units: changedFiles.map((file, order) => ({
      unitId: `fallback-unit-${order + 1}`,
      file,
      order,
      checks: [
        {
          id: `fallback-check-${order + 1}`,
          description: "检查变更逻辑、错误路径和边界条件",
          completionCriteria: ["已核对该文件的变更与受控 diff 摘要"],
          allowedFiles: [file],
          evidenceTargets: ["变更行及其直接上下文"]
        }
      ],
      budget: { ...DEFAULT_PLAN_UNIT_BUDGET }
    }))
  });
}

function formatPlanValidationFeedback(error: PlanValidationError): string {
  return [
    `上一次计划未通过业务校验：${error.message}。`,
    ...(error.details ?? []),
    "请只修复上述问题，并再次调用 submit_review_plan 提交完整计划。"
  ].join("\n");
}

function collectReferencedFiles(plan: ReviewPlan): string[] {
  return stableUnique([
    ...plan.changeSetSummary.files,
    ...plan.riskAreas.flatMap((riskArea) => riskArea.relatedFiles),
    ...plan.units.map((unit) => unit.file),
    ...plan.units.flatMap((unit) => unit.checks.flatMap((check) => check.allowedFiles))
  ]);
}

function getChangedFiles(preAnalysis: ReviewPreAnalysis): string[] {
  return stableUnique(preAnalysis.files.map((file) => file.path));
}

function stableUnique(files: readonly string[]): string[] {
  return [...new Set(files)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function degradedResult(
  preAnalysis: ReviewPreAnalysis,
  error: PlanStageError
): ReviewPlanStageResult {
  return {
    status: "plan-degraded",
    plan: buildDeterministicReviewPlan(preAnalysis),
    error: planStageErrorSchema.parse(error)
  };
}

function revisionRejected(currentPlan: ReviewPlan, error: PlanStageError): ReviewPlanStageResult {
  return {
    status: "revision-rejected",
    plan: currentPlan,
    error: planStageErrorSchema.parse(error)
  };
}

function toPlanStageError(error: unknown): PlanStageError {
  if (error instanceof PlanProviderError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: [...error.details] } : {})
    };
  }

  return {
    code: "provider-error",
    message: error instanceof Error ? error.message : "Plan provider 调用失败"
  };
}
