import { describe, expect, it } from "vitest";
import type { ReflectionResult } from "../src/domain/reflection-result.js";
import type { EvidenceBundle } from "../src/domain/review-evidence.js";
import type { ReviewFinding } from "../src/domain/review-finding.js";
import type { ReviewPlan } from "../src/domain/review-plan.js";
import type { ParsedDiffFile } from "../src/infrastructure/git/parse-unified-diff.js";
import { validateAndNormalizeFindings } from "../src/application/review-result-validation.js";

type ReviewUnit = ReviewPlan["units"][number];

function unit(): ReviewUnit {
  return {
    unitId: "unit-auth",
    file: "src/auth.ts",
    order: 0,
    checks: [
      {
        id: "check-auth",
        description: "检查认证失败分支",
        completionCriteria: ["确认失败会被返回"],
        allowedFiles: ["src/auth.ts"],
        evidenceTargets: ["authenticate"]
      }
    ],
    budget: {
      modelCalls: 3,
      toolCalls: 3,
      maxInputTokens: 1_000,
      maxOutputTokens: 1_000,
      maxReadBytes: 10_000,
      maxDurationMs: 10_000
    }
  };
}

function evidenceBundle(completeness: EvidenceBundle["completeness"] = "complete"): EvidenceBundle {
  return {
    schemaVersion: 1,
    unitId: "unit-auth",
    completeness,
    items: [
      {
        id: "evidence-1",
        checkId: "check-auth",
        source: "file_read_diff",
        arguments: { path: "src/auth.ts" },
        content: "+return false;",
        contentHash: "sha256:existing"
      }
    ]
  };
}

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
    confidenceSignals: ["diff-added-line"],
    status: "line-level",
    ...overrides
  };
}

function reflectionResult(
  candidates: ReflectionResult["candidates"]
): ReflectionResult {
  return {
    schemaVersion: 1,
    unitId: "unit-auth",
    candidates
  };
}

function candidate(
  findingValue: ReviewFinding,
  overrides: Partial<ReflectionResult["candidates"][number]> = {}
): ReflectionResult["candidates"][number] {
  return {
    finding: findingValue,
    evidenceIds: ["evidence-1"],
    counterEvidence: "未发现反例",
    decision: "accept",
    decisionReason: "证据直接支持",
    ...overrides
  };
}

function diffFile(path = "src/auth.ts"): ParsedDiffFile {
  return {
    path,
    isNew: false,
    isDeleted: false,
    isBinary: false,
    insertions: 2,
    deletions: 0,
    hunks: [
      {
        oldStart: 9,
        oldCount: 2,
        newStart: 9,
        newCount: 3,
        lines: [
          { type: "context", content: "function auth() {", oldLineNum: 9, newLineNum: 9 },
          { type: "added", content: "return false;", oldLineNum: null, newLineNum: 10 },
          { type: "added", content: "return true;", oldLineNum: null, newLineNum: 11 }
        ]
      }
    ]
  };
}

function contextOnlyDiffFile(): ParsedDiffFile {
  return {
    path: "src/auth.ts",
    isNew: false,
    isDeleted: false,
    isBinary: false,
    insertions: 0,
    deletions: 0,
    hunks: [
      {
        oldStart: 9,
        oldCount: 1,
        newStart: 9,
        newCount: 1,
        lines: [
          { type: "context", content: "function auth() {", oldLineNum: 9, newLineNum: 9 }
        ]
      }
    ]
  };
}

function deletedDiffFile(isDeleted = false): ParsedDiffFile {
  return {
    path: "src/auth.ts",
    isNew: false,
    isDeleted,
    isBinary: false,
    insertions: 0,
    deletions: 1,
    hunks: [
      {
        oldStart: 10,
        oldCount: 1,
        newStart: 10,
        newCount: 0,
        lines: [
          { type: "deleted", content: "return false;", oldLineNum: 10, newLineNum: null }
        ]
      }
    ]
  };
}

describe("validateAndNormalizeFindings", () => {
  it("只发布引用现有证据且位于授权 diff 行的 accept finding", () => {
    const result = validateAndNormalizeFindings({
      unit: unit(),
      evidenceBundle: evidenceBundle(),
      reflectionResult: reflectionResult([candidate(finding())]),
      diffFiles: [diffFile()],
      fileLineCounts: { "src/auth.ts": 20 }
    });

    expect(result.status).toBe("validated");
    expect(result.findings).toEqual([finding()]);
    expect(result.needsReview).toEqual([]);
    expect(result.rejected).toEqual([]);
  });

  it.each([{ evidenceIds: [] }, { evidenceIds: ["missing-evidence"] }])(
    "把缺少有效 evidenceId 的候选放入 needs-review 而不是正式 finding：%j",
    ({ evidenceIds }) => {
      const result = validateAndNormalizeFindings({
        unit: unit(),
        evidenceBundle: evidenceBundle(),
        reflectionResult: reflectionResult([
          candidate(finding(), { evidenceIds })
        ]),
        diffFiles: [diffFile()]
      });

      expect(result.findings).toEqual([]);
      expect(result.needsReview).toHaveLength(1);
      expect(result.needsReview[0]!.reasons.map((reason) => reason.code)).toContain(
        "evidence-reference-invalid"
      );
      expect(result.rejected).toEqual([]);
    }
  );

  it("拒绝越界文件、无 diff 关联文件和越界行号", () => {
    const result = validateAndNormalizeFindings({
      unit: unit(),
      evidenceBundle: evidenceBundle(),
      reflectionResult: reflectionResult([
        candidate(finding({ id: "outside", file: "src/admin.ts" })),
        candidate(finding({ id: "no-diff", file: "src/dependency.ts" })),
        candidate(finding({ id: "line-outside", startLine: 30, endLine: 30 }))
      ]),
      diffFiles: [diffFile()],
      fileLineCounts: { "src/auth.ts": 20 }
    });

    expect(result.findings).toEqual([]);
    expect(result.rejected.map((item) => item.reasons[0]!.code)).toEqual([
      "file-not-authorized",
      "file-not-authorized",
      "line-out-of-range"
    ]);
  });

  it("授权依赖文件没有 diff 关联时拒绝发布", () => {
    const reviewUnit = unit();
    reviewUnit.checks[0]!.allowedFiles.push("src/dependency.ts");
    const result = validateAndNormalizeFindings({
      unit: reviewUnit,
      evidenceBundle: evidenceBundle(),
      reflectionResult: reflectionResult([
        candidate(finding({ id: "dependency", file: "src/dependency.ts" }))
      ]),
      diffFiles: [diffFile()]
    });

    expect(result.rejected[0]!.reasons[0]!.code).toBe("file-not-in-diff");
  });

  it("无法确定精确位置时降级为 file-level，不把定位问题标成 needs-review", () => {
    const result = validateAndNormalizeFindings({
      unit: unit(),
      evidenceBundle: evidenceBundle(),
      reflectionResult: reflectionResult([
        candidate(finding({ startLine: undefined, endLine: undefined, status: "line-level" }))
      ]),
      diffFiles: [diffFile()]
    });

    expect(result.findings[0]).toMatchObject({ status: "file-level" });
    expect(result.findings[0]).not.toHaveProperty("startLine");
    expect(result.needsReview).toEqual([]);
  });

  it.each([
    { name: "上下文行", diffFile: contextOnlyDiffFile(), line: 9 },
    { name: "纯删除 diff", diffFile: deletedDiffFile(), line: 10 },
    { name: "deleted file", diffFile: deletedDiffFile(true), line: 10 }
  ])("$name 无法关联 added 行时降级为 file-level", ({ diffFile, line }) => {
    const result = validateAndNormalizeFindings({
      unit: unit(),
      evidenceBundle: evidenceBundle(),
      reflectionResult: reflectionResult([
        candidate(finding({ startLine: line, endLine: line }))
      ]),
      diffFiles: [diffFile],
      fileLineCounts: { "src/auth.ts": 20 }
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ status: "file-level" });
    expect(result.findings[0]).not.toHaveProperty("startLine");
    expect(result.rejected).toEqual([]);
  });

  it("未提供文件总行数时不发布明显超大的 line-level 行范围", () => {
    const result = validateAndNormalizeFindings({
      unit: unit(),
      evidenceBundle: evidenceBundle(),
      reflectionResult: reflectionResult([
        candidate(finding({ startLine: 1, endLine: 1_000_000, status: "line-level" }))
      ]),
      diffFiles: [diffFile()]
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ status: "file-level" });
    expect(result.findings[0]).not.toHaveProperty("startLine");
    expect(result.findings[0]).not.toHaveProperty("endLine");
    expect(result.needsReview).toEqual([]);
    expect(result.rejected).toEqual([]);
  });

  it("确定性合并重复 finding，并合并置信信号", () => {
    const first = finding({ id: "first", confidenceSignals: ["signal-a"] });
    const duplicate = finding({
      id: "duplicate",
      summary: "  认证失败被忽略  ",
      confidenceSignals: ["signal-b"]
    });
    const result = validateAndNormalizeFindings({
      unit: unit(),
      evidenceBundle: evidenceBundle(),
      reflectionResult: reflectionResult([candidate(first), candidate(duplicate)]),
      diffFiles: [diffFile()]
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      id: "first",
      confidenceSignals: ["signal-a", "signal-b"]
    });
    expect(result.duplicates).toEqual([{ keptFindingId: "first", mergedFindingId: "duplicate" }]);
  });

  it("只合并相同文件、分类、摘要和行范围，并保留最高 severity", () => {
    const low = finding({ id: "low", severity: "low", startLine: 10, endLine: 10 });
    const high = finding({ id: "high", severity: "high", startLine: 10, endLine: 10 });
    const differentLocation = finding({
      id: "different-location",
      severity: "medium",
      startLine: 11,
      endLine: 11
    });

    const result = validateAndNormalizeFindings({
      unit: unit(),
      evidenceBundle: evidenceBundle(),
      reflectionResult: reflectionResult([
        candidate(low),
        candidate(high),
        candidate(differentLocation)
      ]),
      diffFiles: [diffFile()],
      fileLineCounts: { "src/auth.ts": 20 }
    });

    expect(result.findings).toHaveLength(2);
    expect(result.findings.find((item) => item.startLine === 10)).toMatchObject({
      id: "high",
      severity: "high"
    });
    expect(result.findings.find((item) => item.startLine === 11)).toMatchObject({
      id: "different-location",
      severity: "medium"
    });
    expect(result.duplicates).toEqual([{ keptFindingId: "high", mergedFindingId: "low" }]);
  });

  it("将 evidence-incomplete 与候选 needs-review 作为两个独立维度返回", () => {
    const result = validateAndNormalizeFindings({
      unit: unit(),
      evidenceBundle: evidenceBundle("incomplete"),
      reflectionResult: reflectionResult([
        candidate(finding({ id: "accepted" })),
        candidate(finding({ id: "manual" }), { decision: "needs-review" })
      ]),
      diffFiles: [diffFile()]
    });

    expect(result.status).toBe("evidence-incomplete");
    expect(result.findings.map((item) => item.id)).toEqual(["accepted"]);
    expect(result.needsReview.map((item) => item.candidate.finding.id)).toEqual(["manual"]);
  });
});
