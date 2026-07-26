/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { posix } from "node:path";
import { z } from "zod";
import type { LlmProvider } from "../domain/provider.js";
import {
  reflectionResultSchema,
  type ReflectionCandidate,
  type ReflectionResult
} from "../domain/reflection-result.js";
import {
  evidenceBundleSchema,
  evidenceItemSchema
} from "../domain/review-evidence.js";
import { reviewFindingSchema, type ReviewFinding } from "../domain/review-finding.js";
import { reviewPlanSchema, type ReviewPlan } from "../domain/review-plan.js";
import {
  requestGlobalReviewReflection,
  type GlobalEvidenceSummary,
  type GlobalReflectionFileResult,
  type ReflectionProviderErrorCode
} from "../infrastructure/llm/reflection-provider.js";

export type GlobalReviewReflectionStageInput = {
  reviewPlan: ReviewPlan;
  fileResults: GlobalReflectionFileResult[];
  evidenceSummaries: GlobalEvidenceSummary[];
  provider: Pick<LlmProvider, "id" | "capabilities" | "chat">;
  signal?: AbortSignal;
};

export type GlobalReviewReflectionStageError = {
  code:
    | "structured-output-unsupported"
    | "global-tool-request-denied"
    | "invalid-global-input"
    | Exclude<ReflectionProviderErrorCode, "tool-request-denied">
    | "provider-failed";
  message: string;
};

export type GlobalReviewReflectionStageResult =
  | {
      status: "completed";
      reflectionResult: ReflectionResult;
      findings: ReviewFinding[];
      unadopted: ReflectionCandidate[];
    }
  | {
      status: "reflection-failed";
      findings: ReviewFinding[];
      unadopted: ReflectionCandidate[];
      error: GlobalReviewReflectionStageError;
    };

const globalFileResultSchema = z.object({
  unitId: z.string().min(1),
  reflectionResult: reflectionResultSchema,
  findings: z.array(reviewFindingSchema)
});

const globalEvidenceSummarySchema = evidenceBundleSchema
  .pick({ schemaVersion: true, unitId: true, completeness: true })
  .extend({
    items: z.array(
      evidenceItemSchema
        .pick({ id: true, checkId: true, source: true, contentHash: true })
        .extend({ summary: z.string().min(1) })
    )
  });

export async function runGlobalReviewReflectionStage(
  input: GlobalReviewReflectionStageInput
): Promise<GlobalReviewReflectionStageResult> {
  input.signal?.throwIfAborted();
  const parsedPlan = reviewPlanSchema.safeParse(input.reviewPlan);
  const parsedFileResults = parseArray(input.fileResults, globalFileResultSchema);
  const parsedEvidenceSummaries = parseArray(input.evidenceSummaries, globalEvidenceSummarySchema);
  if (!parsedPlan.success || !parsedFileResults.success || !parsedEvidenceSummaries.success) {
    const validFileResults = parsedFileResults.data;
    const planSchemaFailure = !parsedPlan.success;
    const inputValidation = parsedPlan.success
      ? validateGlobalInputContracts(
          parsedPlan.data,
          validFileResults,
          parsedEvidenceSummaries.data
        )
      : undefined;
    const fileLevel = filterFileLevelBaseline({
      fileResults: validFileResults,
      evidenceSummaries: parsedEvidenceSummaries.data,
      invalidFindingReasons: inputValidation?.invalidFindingReasons ?? (
        planSchemaFailure
          ? reasonsForAllFindings(
              validFileResults,
              "ReviewPlan schema 校验失败，无法确认全局授权范围，禁止发布正式 baseline"
            )
          : new Map()
      )
    });
    return {
      status: "reflection-failed",
      findings: fileLevel.findings,
      unadopted: [
        ...fileLevel.unadopted,
        ...collectSchemaFailureCandidates([
          parsedFileResults,
          parsedEvidenceSummaries
        ])
      ],
      error: {
        code: "invalid-global-input",
        message: [
          `全局 Reflection 输入 schema 校验失败：${formatSchemaIssues([
            parsedPlan,
            parsedFileResults,
            parsedEvidenceSummaries
          ])}`,
          ...(inputValidation?.issues.length
            ? [`全局 Reflection 输入契约校验失败：${inputValidation.issues.join("；")}`]
            : [])
        ].join("；")
      }
    };
  }
  const reviewPlan = parsedPlan.data;
  const fileResults = parsedFileResults.data;
  const evidenceSummaries = parsedEvidenceSummaries.data;
  const inputValidation = validateGlobalInputContracts(
    reviewPlan,
    fileResults,
    evidenceSummaries
  );

  if (inputValidation.issues.length > 0) {
    const fileLevel = filterFileLevelBaseline({
      fileResults,
      evidenceSummaries,
      invalidFindingReasons: inputValidation.invalidFindingReasons
    });
    return {
      status: "reflection-failed",
      findings: fileLevel.findings,
      unadopted: fileLevel.unadopted,
      error: {
        code: "invalid-global-input",
        message: `全局 Reflection 输入契约校验失败：${inputValidation.issues.join("；")}`
      }
    };
  }

  if (input.provider.capabilities.toolCalling !== true) {
    const fileLevel = filterFileLevelBaseline({
      fileResults,
      evidenceSummaries,
      invalidFindingReasons: new Map()
    });
    return {
      status: "reflection-failed",
      findings: fileLevel.findings,
      unadopted: fileLevel.unadopted,
      error: {
        code: "structured-output-unsupported",
        message: "全局 Reflection provider 不支持结构化提交工具，仅保留通过文件级 accept、evidence 和合法性校验的正式 finding"
      }
    };
  }

  let reflectionResult: ReflectionResult;
  try {
    reflectionResult = await requestGlobalReviewReflection({
      provider: input.provider,
      reviewPlan,
      fileResults,
      evidenceSummaries,
      signal: input.signal
    });
  } catch (error) {
    if (input.signal?.aborted) throw input.signal.reason;
    const providerError = error as { code?: unknown };
    const providerCode = isReflectionProviderErrorCode(providerError.code)
      ? providerError.code
      : "provider-failed";
    const fileLevel = filterFileLevelBaseline({
      fileResults,
      evidenceSummaries,
      invalidFindingReasons: new Map()
    });
    return {
      status: "reflection-failed",
      findings: fileLevel.findings,
      unadopted: fileLevel.unadopted,
      error: {
        code: providerCode === "tool-request-denied"
          ? "global-tool-request-denied"
          : providerCode,
        message: error instanceof Error ? error.message : "全局 Reflection provider 调用失败"
      }
    };
  }

  const duplicateGlobalFindingIds = findDuplicateValues(
    reflectionResult.candidates.map((candidate) => candidate.finding.id)
  );
  if (duplicateGlobalFindingIds.size > 0) {
    const fileLevel = filterFileLevelBaseline({
      fileResults,
      evidenceSummaries,
      invalidFindingReasons: new Map()
    });
    return {
      status: "reflection-failed",
      findings: fileLevel.findings,
      unadopted: [
        ...fileLevel.unadopted,
        ...reflectionResult.candidates
          .map((candidate) => ({
            ...candidate,
            decision: "needs-review" as const,
            decisionReason: mergeDecisionReasons(candidate.decisionReason, [
              "全局 ReflectionResult finding id 重复或结果失败，候选未应用"
            ])
          }))
      ],
      error: {
        code: "invalid-result",
        message: `全局 ReflectionResult finding id 不唯一：${[...duplicateGlobalFindingIds].join("、")}`
      }
    };
  }

  return applyGlobalReflectionDecisions({
    reflectionResult,
    fileResults,
    evidenceSummaries
  });
}

type GlobalInputValidation = {
  issues: string[];
  invalidFindingReasons: Map<string, string[]>;
};

function validateGlobalInputContracts(
  reviewPlan: ReviewPlan,
  fileResults: readonly GlobalReflectionFileResult[],
  evidenceSummaries: readonly GlobalEvidenceSummary[]
): GlobalInputValidation {
  const issues: string[] = [];
  const invalidFindingReasons = new Map<string, string[]>();
  const invalidUnitReasons = new Map<string, string[]>();
  const planUnitsById = groupBy(reviewPlan.units, (unit) => unit.unitId);
  const fileResultsByUnitId = groupBy(fileResults, (fileResult) => fileResult.unitId);
  const summariesByUnitId = groupBy(evidenceSummaries, (summary) => summary.unitId);
  const checkOwners = groupBy(
    reviewPlan.units.flatMap((unit) =>
      unit.checks.map((check) => ({ unitId: unit.unitId, checkId: check.id }))
    ),
    (owner) => owner.checkId
  );

  for (const [unitId, units] of planUnitsById) {
    if (units.length > 1) {
      const reason = `全局计划 unitId ${unitId} 不唯一`;
      issues.push(reason);
      addInvalidUnitReason(invalidUnitReasons, unitId, reason);
    }
    if (fileResultsByUnitId.get(unitId)?.length !== 1) {
      const reason = `全局计划 unitId ${unitId} 必须且只能有一个 fileResult`;
      issues.push(reason);
      addInvalidUnitReason(invalidUnitReasons, unitId, reason);
    }
    if (summariesByUnitId.get(unitId)?.length !== 1) {
      const reason = `全局计划 unitId ${unitId} 必须且只能有一个 Evidence 摘要`;
      issues.push(reason);
      addInvalidUnitReason(invalidUnitReasons, unitId, reason);
    }
  }

  for (const [checkId, owners] of checkOwners) {
    if (owners.length > 1) issues.push(`全局计划 checkId ${checkId} 不唯一`);
  }

  for (const [unitId, results] of fileResultsByUnitId) {
    if (results.length > 1) {
      const reason = `fileResult unitId ${unitId} 不唯一`;
      issues.push(reason);
      addInvalidUnitReason(invalidUnitReasons, unitId, reason);
    }
    if (planUnitsById.get(unitId)?.length !== 1) {
      const reason = `fileResult unitId ${unitId} 不存在于唯一的全局计划 unit`;
      issues.push(reason);
      addInvalidUnitReason(invalidUnitReasons, unitId, reason);
    }
  }

  for (const fileResult of fileResults) {
    if (fileResult.reflectionResult.unitId !== fileResult.unitId) {
      const reason =
        `fileResult ${fileResult.unitId} 与 ReflectionResult.unitId ${fileResult.reflectionResult.unitId ?? "缺失"} 不一致`;
      issues.push(reason);
      addInvalidUnitReason(invalidUnitReasons, fileResult.unitId, reason);
    }
    const unit = planUnitsById.get(fileResult.unitId)?.[0];
    const allowedFiles = new Set([
      ...(unit ? [unit.file] : []),
      ...(unit?.checks.flatMap((check) => check.allowedFiles) ?? [])
    ].map(normalizePath));
    const resultFindings = [
      ...fileResult.findings,
      ...fileResult.reflectionResult.candidates.map((candidate) => candidate.finding)
    ];
    for (const finding of resultFindings) {
      if (!allowedFiles.has(normalizePath(finding.file))) {
        const reason =
          `fileResult ${fileResult.unitId} 的 finding ${finding.id} 文件 ${finding.file} 不属于对应 unit 范围`;
        issues.push(reason);
        addInvalidFindingReason(invalidFindingReasons, finding.id, reason);
      }
    }
  }

  for (const [unitId, summaries] of summariesByUnitId) {
    if (summaries.length > 1) {
      const reason = `Evidence 摘要 unitId ${unitId} 不唯一`;
      issues.push(reason);
      addInvalidUnitReason(invalidUnitReasons, unitId, reason);
    }
    if (planUnitsById.get(unitId)?.length !== 1) {
      const reason = `Evidence 摘要 unitId ${unitId} 不存在于唯一的全局计划 unit`;
      issues.push(reason);
      addInvalidUnitReason(invalidUnitReasons, unitId, reason);
    }
  }

  const allUnitIds = new Set([...fileResultsByUnitId.keys(), ...summariesByUnitId.keys()]);
  for (const unitId of allUnitIds) {
    if (
      fileResultsByUnitId.get(unitId)?.length !== 1 ||
      summariesByUnitId.get(unitId)?.length !== 1
    ) {
      const reason = `unitId ${unitId} 的 fileResult 与 Evidence 摘要不是一一匹配`;
      issues.push(reason);
      addInvalidUnitReason(invalidUnitReasons, unitId, reason);
    }
  }

  const evidenceOwners = new Map<
    string,
    Array<{ unitId: string; checkId: string }>
  >();
  for (const summary of evidenceSummaries) {
    for (const item of summary.items) {
      const owners = evidenceOwners.get(item.id) ?? [];
      owners.push({ unitId: summary.unitId, checkId: item.checkId });
      evidenceOwners.set(item.id, owners);
      const checkIdOwners = checkOwners.get(item.checkId) ?? [];
      if (checkIdOwners.length !== 1 || checkIdOwners[0]!.unitId !== summary.unitId) {
        issues.push(
          `evidenceId ${item.id} 的 checkId ${item.checkId} 没有唯一归属于 unitId ${summary.unitId}`
        );
      }
    }
  }
  for (const [evidenceId, owners] of evidenceOwners) {
    if (owners.length > 1) issues.push(`evidenceId ${evidenceId} 在全局 Evidence 摘要中不唯一`);
  }

  for (const fileResult of fileResults) {
    const summary = summariesByUnitId.get(fileResult.unitId)?.[0];
    const localEvidenceIds = new Set(summary?.items.map((item) => item.id) ?? []);
    for (const candidate of fileResult.reflectionResult.candidates) {
      for (const evidenceId of candidate.evidenceIds) {
        const evidenceOwner = evidenceOwners.get(evidenceId);
        const checkId = evidenceOwner?.[0]?.checkId;
        const checkIdOwners = checkId ? checkOwners.get(checkId) ?? [] : [];
        if (
          evidenceOwner?.length !== 1 ||
          !localEvidenceIds.has(evidenceId) ||
          checkIdOwners.length !== 1 ||
          checkIdOwners[0]!.unitId !== fileResult.unitId
        ) {
          const reason =
            `fileResult ${fileResult.unitId} 的 finding ${candidate.finding.id} 引用了错配或 checkId 所有权不唯一的 evidenceId ${evidenceId}`;
          issues.push(reason);
          addInvalidFindingReason(
            invalidFindingReasons,
            candidate.finding.id,
            reason
          );
        }
      }
    }
  }

  const formalFindings = fileResults.flatMap((fileResult) =>
    fileResult.findings.map((finding) => ({ unitId: fileResult.unitId, finding }))
  );
  const findingsById = groupBy(formalFindings, (item) => item.finding.id);
  for (const [findingId, findings] of findingsById) {
    if (findings.length > 1) {
      const reason = `全局 finding id ${findingId} 不唯一`;
      issues.push(reason);
      addInvalidFindingReason(invalidFindingReasons, findingId, reason);
    }
  }

  const reflectionCandidateOwnersById = groupBy(
    fileResults.flatMap((fileResult) =>
      fileResult.reflectionResult.candidates.map((candidate) => ({
        unitId: fileResult.unitId,
        candidate
      }))
    ),
    (owner) => owner.candidate.finding.id
  );
  for (const [findingId, owners] of reflectionCandidateOwnersById) {
    if (owners.length > 1) {
      const reason = `Reflection candidate finding id ${findingId} 不唯一`;
      issues.push(reason);
      addInvalidFindingReason(invalidFindingReasons, findingId, reason);
    }
  }

  for (const { unitId, finding } of formalFindings) {
    const candidateOwners = reflectionCandidateOwnersById.get(finding.id) ?? [];
    if (candidateOwners.length !== 1) {
      const reason =
        `baseline finding ${finding.id} 没有唯一对应的文件级 candidate`;
      issues.push(reason);
      addInvalidFindingReason(invalidFindingReasons, finding.id, reason);
      continue;
    }
    const candidateOwner = candidateOwners[0]!;
    if (candidateOwner.unitId !== unitId) {
      const reason =
        `baseline finding ${finding.id} 与文件级 candidate 所属 unit 不一致`;
      issues.push(reason);
      addInvalidFindingReason(invalidFindingReasons, finding.id, reason);
      continue;
    }
    if (!sameFindingContent(finding, candidateOwner.candidate.finding)) {
      const reason =
        `baseline finding ${finding.id} 与文件级 candidate 内容不一致`;
      issues.push(reason);
      addInvalidFindingReason(invalidFindingReasons, finding.id, reason);
    }
  }

  for (const fileResult of fileResults) {
    const unitReasons = invalidUnitReasons.get(fileResult.unitId);
    if (!unitReasons) continue;
    const unitFindingIds = new Set([
      ...fileResult.findings.map((finding) => finding.id),
      ...fileResult.reflectionResult.candidates.map((candidate) => candidate.finding.id)
    ]);
    for (const findingId of unitFindingIds) {
      for (const reason of unitReasons) {
        addInvalidFindingReason(invalidFindingReasons, findingId, reason);
      }
    }
  }

  return { issues: [...new Set(issues)], invalidFindingReasons };
}

function addInvalidFindingReason(
  reasonsByFindingId: Map<string, string[]>,
  findingId: string,
  reason: string
): void {
  const reasons = reasonsByFindingId.get(findingId) ?? [];
  if (!reasons.includes(reason)) reasons.push(reason);
  reasonsByFindingId.set(findingId, reasons);
}

function addInvalidUnitReason(
  reasonsByUnitId: Map<string, string[]>,
  unitId: string,
  reason: string
): void {
  const reasons = reasonsByUnitId.get(unitId) ?? [];
  reasons.push(reason);
  reasonsByUnitId.set(unitId, reasons);
}

function groupBy<T>(
  values: readonly T[],
  keyOf: (value: T) => string
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    const group = grouped.get(key) ?? [];
    group.push(value);
    grouped.set(key, group);
  }
  return grouped;
}

function findDuplicateValues(values: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates;
}

function applyGlobalReflectionDecisions(input: {
  reflectionResult: ReflectionResult;
  fileResults: GlobalReflectionFileResult[];
  evidenceSummaries: GlobalEvidenceSummary[];
}): Extract<GlobalReviewReflectionStageResult, { status: "completed" }> {
  const fileLevel = filterFileLevelBaseline({
    fileResults: input.fileResults,
    evidenceSummaries: input.evidenceSummaries,
    invalidFindingReasons: new Map()
  });
  const baselineFindings = fileLevel.findings;
  const baselineById = new Map(baselineFindings.map((finding) => [finding.id, finding]));
  const globalEvidenceIds = new Set(
    input.evidenceSummaries.flatMap((summary) => summary.items.map((item) => item.id))
  );
  const removedFindingIds = new Set<string>();
  const severityByFindingId = new Map<string, ReviewFinding["severity"]>();
  const unadopted = [...fileLevel.unadopted];
  const normalizedCandidates: ReflectionCandidate[] = [];

  for (const candidate of input.reflectionResult.candidates) {
    const baseline = baselineById.get(candidate.finding.id);
    const hasGlobalEvidence =
      candidate.evidenceIds.length > 0 &&
      candidate.evidenceIds.every((evidenceId) => globalEvidenceIds.has(evidenceId));
    const canApply =
      baseline !== undefined &&
      hasGlobalEvidence &&
      sameFindingScope(candidate.finding, baseline);

    if (!canApply) {
      const rejected = rejectUnsupportedGlobalCandidate(candidate);
      normalizedCandidates.push(rejected);
      unadopted.push(rejected);
      continue;
    }

    normalizedCandidates.push(candidate);
    if (candidate.decision === "accept") {
      severityByFindingId.set(candidate.finding.id, candidate.finding.severity);
      continue;
    }

    removedFindingIds.add(candidate.finding.id);
    unadopted.push(candidate);
  }

  const findings = baselineFindings
    .filter((finding) => !removedFindingIds.has(finding.id))
    .map((finding) => ({
      ...finding,
      severity: severityByFindingId.get(finding.id) ?? finding.severity
    }));

  return {
    status: "completed",
    reflectionResult: reflectionResultSchema.parse({
      ...input.reflectionResult,
      candidates: normalizedCandidates
    }),
    findings,
    unadopted
  };
}

function collectFileUnadoptedCandidates(
  fileResults: readonly GlobalReflectionFileResult[]
): ReflectionCandidate[] {
  return fileResults.flatMap((fileResult) => {
    const formalFindingIds = new Set(fileResult.findings.map((finding) => finding.id));
    return fileResult.reflectionResult.candidates.filter(
      (candidate) => candidate.decision !== "accept" || !formalFindingIds.has(candidate.finding.id)
    );
  });
}

function filterFileLevelBaseline(input: {
  fileResults: readonly GlobalReflectionFileResult[];
  evidenceSummaries: readonly GlobalEvidenceSummary[];
  invalidFindingReasons: ReadonlyMap<string, readonly string[]>;
}): { findings: ReviewFinding[]; unadopted: ReflectionCandidate[] } {
  const removedFindingIds = new Set<string>();
  const unadopted = collectFileUnadoptedCandidates(input.fileResults);
  const evidenceIdsByUnit = new Map(
    input.evidenceSummaries.map((summary) => [
      summary.unitId,
      new Set(summary.items.map((item) => item.id))
    ])
  );

  for (const fileResult of input.fileResults) {
    for (const finding of fileResult.findings) {
      const candidate = fileResult.reflectionResult.candidates.find(
        (item) => item.finding.id === finding.id
      );
      const invalidReasons = input.invalidFindingReasons.get(finding.id) ?? [];
      const hasValidEvidence = candidate !== undefined &&
        candidate.evidenceIds.length > 0 &&
        candidate.evidenceIds.every(
          (id) => evidenceIdsByUnit.get(fileResult.unitId)?.has(id) === true
        );

      if (
        candidate === undefined ||
        candidate.decision !== "accept" ||
        !hasValidEvidence ||
        invalidReasons.length > 0
      ) {
        removedFindingIds.add(finding.id);
      }

      if (candidate === undefined) {
        unadopted.push(makeNeedsReviewCandidate(
          finding,
          undefined,
          ["正式 baseline 没有唯一且合法的文件级 candidate"]
        ));
      } else if (invalidReasons.length > 0) {
        const needsReview = makeNeedsReviewCandidate(finding, candidate, invalidReasons);
        const existingIndex = unadopted.findIndex(
          (item) => item.finding.id === finding.id && item.finding.file === finding.file
        );
        if (existingIndex >= 0) unadopted[existingIndex] = needsReview;
        else unadopted.push(needsReview);
      } else if (candidate.decision === "accept" && !hasValidEvidence) {
        unadopted.push(makeNeedsReviewCandidate(finding, candidate, [
          "文件级 candidate 没有有效 evidence，禁止发布正式 baseline finding"
        ]));
      }
    }
  }

  for (const fileResult of input.fileResults) {
    const formalFindingIds = new Set(fileResult.findings.map((finding) => finding.id));
    for (const candidate of fileResult.reflectionResult.candidates) {
      const reasons = input.invalidFindingReasons.get(candidate.finding.id);
      if (!reasons || formalFindingIds.has(candidate.finding.id)) continue;
      const needsReview = {
        ...candidate,
        decision: "needs-review",
        decisionReason: mergeDecisionReasons(candidate.decisionReason, reasons)
      } satisfies ReflectionCandidate;
      const existingIndex = unadopted.findIndex(
        (item) => item.finding.id === candidate.finding.id && item.finding.file === candidate.finding.file
      );
      if (existingIndex >= 0) unadopted[existingIndex] = needsReview;
      else unadopted.push(needsReview);
    }
  }

  return {
    findings: input.fileResults
      .flatMap((fileResult) => fileResult.findings)
      .filter((finding) => !removedFindingIds.has(finding.id)),
    unadopted
  };
}

function reasonsForAllFindings(
  fileResults: readonly GlobalReflectionFileResult[],
  reason: string
): Map<string, string[]> {
  const reasons = new Map<string, string[]>();
  for (const fileResult of fileResults) {
    for (const finding of [
      ...fileResult.findings,
      ...fileResult.reflectionResult.candidates.map((candidate) => candidate.finding)
    ]) {
      addInvalidFindingReason(reasons, finding.id, reason);
    }
  }
  return reasons;
}

function makeNeedsReviewCandidate(
  finding: ReviewFinding,
  source: Pick<ReflectionCandidate, "evidenceIds" | "counterEvidence" | "decisionReason"> | undefined,
  reasons: readonly string[]
): ReflectionCandidate {
  return {
    finding,
    evidenceIds: source?.evidenceIds ?? [],
    counterEvidence: source?.counterEvidence ?? "",
    decision: "needs-review",
    decisionReason: mergeDecisionReasons(source?.decisionReason, reasons)
  };
}

function sameFindingScope(candidate: ReviewFinding, baseline: ReviewFinding): boolean {
  return sameStableFindingFields(candidate, baseline);
}

function sameFindingContent(baseline: ReviewFinding, candidate: ReviewFinding): boolean {
  return baseline.severity === candidate.severity &&
    sameStableFindingFields(baseline, candidate, true);
}

function sameStableFindingFields(
  left: ReviewFinding,
  right: ReviewFinding,
  allowCandidateLineForFileBaseline = false
): boolean {
  const stableFields = (finding: ReviewFinding) => ({
    id: finding.id,
    category: normalizeFindingText(finding.category),
    summary: normalizeFindingText(finding.summary),
    file: normalizePath(finding.file)
  });
  const location = (finding: ReviewFinding) =>
      finding.status === "file-level" || finding.startLine === undefined
        ? "file"
        : `${finding.startLine}-${finding.endLine ?? finding.startLine}`
  const sameLocation = allowCandidateLineForFileBaseline && location(left) === "file"
    ? true
    : location(left) === location(right);
  return sameLocation && JSON.stringify(stableFields(left)) === JSON.stringify(stableFields(right));
}

function normalizeFindingText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function normalizePath(value: string): string {
  return posix.normalize(value.replaceAll("\\", "/")).replace(/^\.\//, "");
}

function mergeDecisionReasons(
  originalReason: string | undefined,
  appendedReasons: readonly string[]
): string {
  return [...new Set([originalReason, ...appendedReasons].filter((reason): reason is string => Boolean(reason)))].join("；");
}

type ParsedArrayResult<S extends z.ZodTypeAny> =
  | {
      success: true;
      data: z.infer<S>[];
      elementErrors: never[];
    }
  | {
      success: false;
      data: z.infer<S>[];
      error: z.ZodError;
      elementErrors: Array<{ index: number; message: string }>;
    };

function parseArray<S extends z.ZodTypeAny>(
  value: unknown,
  schema: S
): ParsedArrayResult<S> {
  if (!Array.isArray(value)) {
    return {
      success: false,
      data: [],
      error: new z.ZodError([{ code: "invalid_type", expected: "array", received: typeof value, path: [], message: "必须是数组" }]),
      elementErrors: [{ index: -1, message: "必须是数组" }]
    };
  }
  const parsed: z.infer<S>[] = [];
  const issues: z.ZodIssue[] = [];
  const elementErrors: Array<{ index: number; message: string }> = [];
  for (const [index, item] of value.entries()) {
    const result = schema.safeParse(item);
    if (result.success) parsed.push(result.data);
    else {
      const messages = result.error.issues.map((issue) => issue.message);
      elementErrors.push({ index, message: messages.join("；") });
      issues.push(...result.error.issues.map((issue) => ({ ...issue, path: [index, ...issue.path] })));
    }
  }
  return issues.length > 0
    ? { success: false, data: parsed, error: new z.ZodError(issues), elementErrors }
    : { success: true, data: parsed, elementErrors: [] };
}

function formatSchemaIssues(
  results: ReadonlyArray<unknown>
): string {
  return results
    .flatMap((result) => {
      if (!isFailedParseResult(result)) return [];
      return result.error.issues;
    })
    .map((issue) => `${formatIssuePath(issue.path)}: ${issue.message}`)
    .join("；");
}

function collectSchemaFailureCandidates(results: ReadonlyArray<unknown>): ReflectionCandidate[] {
  return results.flatMap((result, resultIndex) => {
    if (!isFailedArrayParseResult(result)) return [];
    const collection = resultIndex === 0 ? "fileResults" : "evidenceSummaries";
    return result.elementErrors.map(({ index, message }) => ({
      finding: {
        id: `invalid-schema-${collection}-${index}`,
        severity: "low" as const,
        category: "schema-validation",
        summary: "跨阶段输入元素无法解析",
        explanation: "该输入元素未通过 Reflection stage schema 校验，未进入正式结果。",
        file: "<invalid-input>",
        confidenceSignals: [],
        status: "file-level" as const
      },
      evidenceIds: [],
      counterEvidence: "",
      decision: "needs-review" as const,
      decisionReason: `${collection}[${index}] schema 校验失败：${message}`
    }));
  });
}

function isFailedParseResult(
  value: unknown
): value is { success: false; error: z.ZodError } {
  return typeof value === "object" && value !== null &&
    "success" in value && value.success === false &&
    "error" in value && value.error instanceof z.ZodError;
}

function isFailedArrayParseResult(
  value: unknown
): value is { success: false; elementErrors: Array<{ index: number; message: string }> } {
  return isFailedParseResult(value) && "elementErrors" in value && Array.isArray(value.elementErrors);
}

function formatIssuePath(path: readonly (string | number)[]): string {
  return path.reduce<string>((result, part) =>
    typeof part === "number" ? `${result}[${part}]` : `${result}${result ? "." : ""}${part}`,
  "") || "input";
}

function rejectUnsupportedGlobalCandidate(candidate: ReflectionCandidate): ReflectionCandidate {
  return {
    ...candidate,
    decision: "reject",
    decisionReason: `${candidate.decisionReason}；没有对应的文件级正式 finding 或有效文件级 evidence，禁止新增或扩大范围`
  };
}

function isReflectionProviderErrorCode(value: unknown): value is ReflectionProviderErrorCode {
  return value === "empty-response" ||
    value === "invalid-json" ||
    value === "invalid-result" ||
    value === "tool-request-denied";
}
