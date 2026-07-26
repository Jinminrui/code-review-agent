import { posix } from "node:path";
import type {
  ReflectionCandidate,
  ReflectionResult
} from "../domain/reflection-result.js";
import type { EvidenceBundle } from "../domain/review-evidence.js";
import type { ReviewFinding } from "../domain/review-finding.js";
import type { ReviewPlan } from "../domain/review-plan.js";
import type { ParsedDiffFile } from "../infrastructure/git/parse-unified-diff.js";

type ReviewUnit = ReviewPlan["units"][number];

// 严重程度只用于同位置重复 finding 的确定性合并。
const FINDING_SEVERITY_RANK: Record<ReviewFinding["severity"], number> = {
  low: 1,
  medium: 2,
  high: 3
};

export type FindingValidationReasonCode =
  | "reflection-rejected"
  | "reflection-needs-review"
  | "evidence-reference-invalid"
  | "unit-mismatch"
  | "file-not-authorized"
  | "file-not-in-diff"
  | "line-out-of-range";

export type FindingValidationReason = {
  code: FindingValidationReasonCode;
  message: string;
};

export type TracedReflectionCandidate = {
  candidate: ReflectionCandidate;
  reasons: FindingValidationReason[];
};

export type FindingValidationResult = {
  status: "validated" | "evidence-incomplete";
  findings: ReviewFinding[];
  needsReview: TracedReflectionCandidate[];
  rejected: TracedReflectionCandidate[];
  duplicates: Array<{ keptFindingId: string; mergedFindingId: string }>;
};

export function validateAndNormalizeFindings(input: {
  unit: ReviewUnit;
  evidenceBundle: EvidenceBundle;
  reflectionResult: ReflectionResult;
  diffFiles: readonly ParsedDiffFile[];
  fileLineCounts?: Readonly<Record<string, number>>;
}): FindingValidationResult {
  const findings: ReviewFinding[] = [];
  const findingKeys: string[] = [];
  const needsReview: TracedReflectionCandidate[] = [];
  const rejected: TracedReflectionCandidate[] = [];
  const duplicates: FindingValidationResult["duplicates"] = [];
  const allowedFiles = new Set([
    normalizePath(input.unit.file),
    ...input.unit.checks.flatMap((check) => check.allowedFiles.map(normalizePath))
  ]);
  const diffFiles = new Map(
    input.diffFiles.map((file) => [normalizePath(file.path), file] as const)
  );
  const fileLineCounts = new Map(
    Object.entries(input.fileLineCounts ?? {}).map(([path, count]) => [normalizePath(path), count])
  );
  const unitCheckIds = new Set(input.unit.checks.map((check) => check.id));
  const evidenceIds = new Set(
    input.evidenceBundle.items
      .filter((item) => unitCheckIds.has(item.checkId))
      .map((item) => item.id)
  );
  const unitMismatch =
    input.evidenceBundle.unitId !== input.unit.unitId ||
    input.reflectionResult.unitId !== input.unit.unitId;

  for (const candidate of input.reflectionResult.candidates) {
    if (candidate.decision === "reject") {
      rejected.push(trace(candidate, "reflection-rejected", candidate.decisionReason));
      continue;
    }

    if (unitMismatch) {
      rejected.push(
        trace(candidate, "unit-mismatch", "ReflectionResult、EvidenceBundle 与文件子计划 unitId 不一致")
      );
      continue;
    }

    if (candidate.decision === "needs-review") {
      needsReview.push(trace(candidate, "reflection-needs-review", candidate.decisionReason));
      continue;
    }

    if (
      candidate.evidenceIds.length === 0 ||
      !candidate.evidenceIds.every((evidenceId) => evidenceIds.has(evidenceId))
    ) {
      needsReview.push(
        trace(
          candidate,
          "evidence-reference-invalid",
          "候选 finding 没有引用当前文件子计划中真实存在的 evidenceId"
        )
      );
      continue;
    }

    const normalizedFile = normalizePath(candidate.finding.file);
    if (!allowedFiles.has(normalizedFile)) {
      rejected.push(
        trace(candidate, "file-not-authorized", `文件 ${normalizedFile} 不在文件子计划授权范围内`)
      );
      continue;
    }

    const diffFile = diffFiles.get(normalizedFile);
    if (!diffFile) {
      rejected.push(
        trace(candidate, "file-not-in-diff", `文件 ${normalizedFile} 与当前变更 diff 无关联`)
      );
      continue;
    }

    const normalizedFinding = normalizeFindingLocation(
      { ...candidate.finding, file: normalizedFile },
      diffFile,
      fileLineCounts.get(normalizedFile)
    );
    if ("reason" in normalizedFinding) {
      rejected.push({ candidate, reasons: [normalizedFinding.reason] });
      continue;
    }

    const candidateKey = findingKey(normalizedFinding.finding, candidate.finding);
    const duplicateIndex = findingKeys.indexOf(candidateKey);
    if (duplicateIndex >= 0) {
      const keptFinding = findings[duplicateIndex]!;
      const incomingFinding = normalizedFinding.finding;
      const highestSeverity =
        FINDING_SEVERITY_RANK[incomingFinding.severity] > FINDING_SEVERITY_RANK[keptFinding.severity]
          ? incomingFinding
          : keptFinding;
      findings[duplicateIndex] = {
        ...highestSeverity,
        confidenceSignals: unique([
          ...keptFinding.confidenceSignals,
          ...incomingFinding.confidenceSignals
        ])
      };
      duplicates.push({
        keptFindingId: findings[duplicateIndex]!.id,
        mergedFindingId:
          findings[duplicateIndex]!.id === keptFinding.id
            ? incomingFinding.id
            : keptFinding.id
      });
      continue;
    }

    findings.push(normalizedFinding.finding);
    findingKeys.push(candidateKey);
  }

  return {
    status: isEvidenceIncomplete(input.unit, input.evidenceBundle)
      ? "evidence-incomplete"
      : "validated",
    findings,
    needsReview,
    rejected,
    duplicates
  };
}

function normalizeFindingLocation(
  finding: ReviewFinding,
  diffFile: ParsedDiffFile,
  fileLineCount?: number
):
  | { finding: ReviewFinding }
  | { reason: FindingValidationReason } {
  if (finding.status === "file-level" || finding.startLine === undefined) {
    return { finding: downgradeToFileLevel(finding) };
  }

  const startLine = finding.startLine;
  const endLine = finding.endLine ?? startLine;
  if (endLine < startLine) {
    return {
      reason: {
        code: "line-out-of-range",
        message: `finding 行范围 ${startLine}-${endLine} 超出文件有效范围`
      }
    };
  }

  if (fileLineCount === undefined) {
    return { finding: downgradeToFileLevel(finding) };
  }

  if (startLine > fileLineCount || endLine > fileLineCount) {
    return {
      reason: {
        code: "line-out-of-range",
        message: `finding 行范围 ${startLine}-${endLine} 超出文件有效范围`
      }
    };
  }

  const addedLines = diffFile.hunks.flatMap((hunk) =>
    hunk.lines
      .filter((line) => line.type === "added" && line.newLineNum !== null)
      .map((line) => line.newLineNum as number)
  );
  const touchesAddedLine = addedLines.some(
    (line) => line >= startLine && line <= endLine
  );
  if (!touchesAddedLine) {
    return { finding: downgradeToFileLevel(finding) };
  }

  return { finding: { ...finding, status: "line-level" } };
}

function isEvidenceIncomplete(unit: ReviewUnit, bundle: EvidenceBundle): boolean {
  if (bundle.completeness === "incomplete" || unit.checks.length === 0) return true;
  const coveredChecks = new Set(bundle.items.map((item) => item.checkId));
  return unit.checks.some((check) => !coveredChecks.has(check.id));
}

function trace(
  candidate: ReflectionCandidate,
  code: FindingValidationReasonCode,
  message: string
): TracedReflectionCandidate {
  return { candidate, reasons: [{ code, message }] };
}

function findingKey(finding: ReviewFinding, originalFinding = finding): string {
  const location =
    originalFinding.status === "file-level" || originalFinding.startLine === undefined
      ? "file"
      : `${originalFinding.startLine}-${originalFinding.endLine ?? originalFinding.startLine}`;
  return [
    normalizePath(finding.file),
    finding.category.trim().toLocaleLowerCase(),
    finding.summary.trim().replace(/\s+/g, " ").toLocaleLowerCase(),
    location
  ].join("\u0000");
}

function downgradeToFileLevel(finding: ReviewFinding): ReviewFinding {
  const { startLine: _startLine, endLine: _endLine, ...fileFinding } = finding;
  return { ...fileFinding, status: "file-level" };
}

function normalizePath(path: string): string {
  return posix.normalize(path.replaceAll("\\", "/")).replace(/^\.\//, "");
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
