/**
 * 模块职责：在进入 Global Reflection 前，清洗文件级结果边界。
 * 边界约束：只过滤 Reflection candidate，不修改正式 finding，并保留拒绝轨迹。
 */
import type { ReflectionCandidate, ReflectionResult } from "../domain/reflection-result.js";
import type { ReviewFinding } from "../domain/review-finding.js";
import type {
  GlobalEvidenceSummary,
  GlobalReflectionFileResult
} from "../infrastructure/llm/reflection-provider.js";

export type GlobalCandidateRejectionReason =
  | "finding-id-not-allowed"
  | "finding-id-duplicate"
  | "evidence-id-not-owned"
  | "finding-content-mismatch"
  | "file-not-owned";

export type GlobalCandidateRejection = {
  candidate: ReflectionCandidate;
  reason: GlobalCandidateRejectionReason;
  unitId: string;
};

export type SanitizedGlobalFileResult = {
  fileResult: GlobalReflectionFileResult;
  rejectedCandidates: GlobalCandidateRejection[];
};

export function sanitizeFileResultForGlobal(input: {
  unitId: string;
  file: string;
  findings: readonly ReviewFinding[];
  reflectionResult: ReflectionResult;
  evidenceSummary: GlobalEvidenceSummary;
}): SanitizedGlobalFileResult {
  const allowedFindingIds = new Set(input.findings.map((finding) => finding.id));
  const findingsById = new Map(input.findings.map((finding) => [finding.id, finding]));
  const ownedEvidenceIds = new Set(input.evidenceSummary.items.map((item) => item.id));
  const candidates: ReflectionCandidate[] = [];
  const rejectedCandidates: GlobalCandidateRejection[] = [];

  for (const candidate of input.reflectionResult.candidates) {
    const findingId = candidate.finding.id;
    if (!allowedFindingIds.has(findingId)) {
      rejectedCandidates.push(reject(candidate, input.unitId, "finding-id-not-allowed"));
      continue;
    }

    if (!candidate.evidenceIds.every((evidenceId) => ownedEvidenceIds.has(evidenceId))) {
      rejectedCandidates.push(reject(candidate, input.unitId, "evidence-id-not-owned"));
      continue;
    }

    if (normalizePath(candidate.finding.file) !== normalizePath(input.file)) {
      rejectedCandidates.push(reject(candidate, input.unitId, "file-not-owned"));
      continue;
    }

    const formalFinding = findingsById.get(findingId)!;
    const previous = candidates.find((item) => item.finding.id === findingId);
    if (previous) {
      rejectedCandidates.push(
        reject(
          candidate,
          input.unitId,
          sameFindingContent(previous.finding, candidate.finding)
            ? "finding-id-duplicate"
            : "finding-content-mismatch"
        )
      );
      continue;
    }

    if (!sameFindingContent(formalFinding, candidate.finding)) {
      rejectedCandidates.push(reject(candidate, input.unitId, "finding-content-mismatch"));
      continue;
    }

    candidates.push(candidate);
  }

  return {
    fileResult: {
      unitId: input.unitId,
      findings: [...input.findings],
      reflectionResult: {
        ...input.reflectionResult,
        candidates
      }
    },
    rejectedCandidates
  };
}

function reject(
  candidate: ReflectionCandidate,
  unitId: string,
  reason: GlobalCandidateRejectionReason
): GlobalCandidateRejection {
  return { candidate, reason, unitId };
}

function sameFindingContent(left: ReviewFinding, right: ReviewFinding): boolean {
  const leftLocation = location(left);
  const rightLocation = location(right);
  const sameLocation = left.status === "file-level" || left.startLine === undefined
    ? true
    : leftLocation === rightLocation;
  return sameLocation &&
    left.severity === right.severity &&
    JSON.stringify(stableFinding(left)) === JSON.stringify(stableFinding(right));
}

function stableFinding(finding: ReviewFinding): Pick<ReviewFinding, "id" | "category" | "summary" | "file"> {
  return {
    id: finding.id,
    file: normalizePath(finding.file),
    category: normalizeText(finding.category),
    summary: normalizeText(finding.summary)
  };
}

function location(finding: ReviewFinding): string {
  return finding.status === "file-level" || finding.startLine === undefined
    ? "file"
    : `${finding.startLine}-${finding.endLine ?? finding.startLine}`;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}
