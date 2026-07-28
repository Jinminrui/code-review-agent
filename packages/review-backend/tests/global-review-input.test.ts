/**
 * 模块职责：验证 Global Reflection 输入边界清洗的确定性行为。
 * 边界约束：非法候选只能被隔离并记录，不能污染正式 finding。
 */
import { describe, expect, it } from "vitest";
import type { EvidenceBundle } from "../src/domain/review-evidence.js";
import type { ReflectionResult } from "../src/domain/reflection-result.js";
import type { ReviewFinding } from "../src/domain/review-finding.js";
import {
  sanitizeFileResultForGlobal
} from "../src/application/global-review-input.js";

function finding(overrides: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    id: "finding-auth",
    severity: "high",
    category: "correctness",
    summary: "认证失败被忽略",
    explanation: "调用方继续执行受保护逻辑。",
    file: "src/auth.ts",
    startLine: 10,
    endLine: 10,
    evidence: "return false",
    confidenceSignals: [],
    status: "line-level",
    ...overrides
  };
}

function candidate(
  value: ReviewFinding,
  evidenceIds: string[] = ["unit-auth-evidence-1"]
): ReflectionResult["candidates"][number] {
  return {
    finding: value,
    evidenceIds,
    counterEvidence: "未发现反例",
    decision: "accept",
    decisionReason: "证据直接支持"
  };
}

function reflectionResult(
  candidates: ReflectionResult["candidates"]
): ReflectionResult {
  return { schemaVersion: 1, unitId: "unit-auth", candidates };
}

function evidenceSummary(ids: string[]): {
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
} {
  return {
    schemaVersion: 1,
    unitId: "unit-auth",
    completeness: "complete",
    items: ids.map((id) => ({
      id,
      checkId: "check-auth",
      source: "file_read_diff",
      contentHash: `hash:${id}`,
      summary: "认证失败分支"
    }))
  };
}

describe("sanitizeFileResultForGlobal", () => {
  it("只保留正式 finding 对应且引用本 unit evidence 的 candidate", () => {
    const result = sanitizeFileResultForGlobal({
      unitId: "unit-auth",
      file: "src/auth.ts",
      findings: [finding({ id: "weak-password-validation" })],
      reflectionResult: reflectionResult([
        candidate(finding({ id: "weak-password-validation" })),
        candidate(finding({ id: "hardcoded-jwt-secret" }), ["reflection-evidence-1"])
      ]),
      evidenceSummary: evidenceSummary(["unit-auth-evidence-1"])
    });

    expect(result.fileResult.reflectionResult.candidates).toHaveLength(1);
    expect(result.rejectedCandidates).toContainEqual(expect.objectContaining({
      reason: "finding-id-not-allowed"
    }));
  });

  it("记录 evidence、文件归属和重复 candidate 的拒绝原因", () => {
    const formal = finding({ id: "weak-password-validation" });
    const result = sanitizeFileResultForGlobal({
      unitId: "unit-auth",
      file: "src/auth.ts",
      findings: [formal],
      reflectionResult: reflectionResult([
        candidate(formal, ["wrong-evidence"]),
        candidate({ ...formal, file: "src/client.ts" }),
        candidate(formal),
        candidate(formal)
      ]),
      evidenceSummary: evidenceSummary(["unit-auth-evidence-1"])
    });

    expect(result.fileResult.reflectionResult.candidates).toHaveLength(1);
    expect(result.rejectedCandidates.map((item) => item.reason)).toEqual([
      "evidence-id-not-owned",
      "file-not-owned",
      "finding-id-duplicate"
    ]);
  });
});
