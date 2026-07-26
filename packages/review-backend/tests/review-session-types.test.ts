import { describe, expect, it } from "vitest";
import { reviewFindingSchema, reviewSessionInputSchema } from "../src/index.js";
import { evidenceBundleSchema } from "../src/domain/review-evidence.js";
import { reviewPlanSchema } from "../src/domain/review-plan.js";
import { reflectionResultSchema } from "../src/domain/reflection-result.js";
import { phaseBudgetSchema } from "../src/domain/review-runtime.js";
import { reviewSessionDetailSchema, reviewSessionEventSchema } from "../src/domain/review-session.js";

describe("review session schemas", () => {
  it("accepts a line-level finding", () => {
    const finding = reviewFindingSchema.parse({
      id: "f_1",
      severity: "high",
      category: "bug-risk",
      summary: "可能遗漏空值保护",
      explanation: "新分支未覆盖 undefined 场景",
      file: "src/service.ts",
      startLine: 12,
      endLine: 14,
      confidenceSignals: ["diff-hit", "line-located"],
      status: "line-level"
    });

    expect(finding.startLine).toBe(12);
  });

  it("rejects an invalid review input", () => {
    expect(() =>
      reviewSessionInputSchema.parse({
        repositoryPath: "",
        baseRef: "main",
        targetRef: "feature"
      })
    ).toThrow();
  });
});

describe("review session schemas cancellation", () => {
  it("accepts cancelled session details with createdAt", () => {
    const parsed = reviewSessionDetailSchema.parse({
      sessionId: "s_1",
      status: "cancelled",
      createdAt: "2026-06-19T00:00:00.000Z",
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature",
      summary: {
        changedFilesCount: 2,
        findingsCount: 0,
        highSeverityCount: 0,
        files: ["src/a.ts", "src/b.ts"]
      },
      findings: [],
      diffByFile: {}
    });

    expect(parsed.status).toBe("cancelled");
    expect(parsed.createdAt).toBe("2026-06-19T00:00:00.000Z");
  });

  it("accepts session-cancelled events", () => {
    const parsed = reviewSessionEventSchema.parse({
      type: "session-cancelled",
      sessionId: "s_1",
      totalFindings: 3
    });

    expect(parsed).toMatchObject({
      type: "session-cancelled",
      totalFindings: 3
    });
  });
});

describe("review session event schemas", () => {
  it("accepts unit-completed events with streaming diff content", () => {
    const parsed = reviewSessionEventSchema.parse({
      type: "unit-completed",
      sessionId: "s_1",
      unitId: "unit:src/file.ts",
      findingsCount: 1,
      findings: [
        {
          id: "f_1",
          severity: "high",
          category: "bug",
          summary: "空值会导致崩溃",
          explanation: "新增代码没有校验 null。",
          file: "src/file.ts",
          startLine: 2,
          endLine: 2,
          confidenceSignals: [],
          status: "line-level"
        }
      ],
      diffByFile: {
        "src/file.ts": {
          original: "export const value = 1;\n",
          modified: "export const value = maybeNull.value;\n"
        }
      }
    });

    expect(parsed.type).toBe("unit-completed");
    if (parsed.type !== "unit-completed") {
      throw new Error("expected unit-completed event");
    }
    expect(parsed.diffByFile["src/file.ts"]?.modified).toContain("maybeNull");
  });

  it("accepts a legal runtime phase transition", () => {
    const parsed = reviewSessionEventSchema.parse({
      type: "phase-transitioned",
      sessionId: "s_1",
      schemaVersion: 1,
      runtimeVersion: "1.0.0",
      previousPhase: "session-created",
      phase: "pre-analysis-completed"
    });

    expect(parsed).toMatchObject({
      type: "phase-transitioned",
      phase: "pre-analysis-completed"
    });
  });

  it("rejects a runtime event without schemaVersion", () => {
    expect(() =>
      reviewSessionEventSchema.parse({
        type: "phase-transitioned",
        sessionId: "s_1",
        runtimeVersion: "1.0.0",
        previousPhase: "session-created",
        phase: "pre-analysis-completed"
      })
    ).toThrow();
  });

  it("rejects an illegal runtime phase transition", () => {
    expect(() =>
      reviewSessionEventSchema.parse({
        type: "phase-transitioned",
        sessionId: "s_1",
        schemaVersion: 1,
        runtimeVersion: "1.0.0",
        previousPhase: "session-created",
        phase: "reflection-validating"
      })
    ).toThrow();
  });
});

describe("review runtime contract schemas", () => {
  it("rejects negative phase budgets", () => {
    expect(() =>
      phaseBudgetSchema.parse({
        modelCalls: -1,
        toolCalls: 0,
        maxInputTokens: 1000,
        maxOutputTokens: 500,
        maxReadBytes: 4096,
        maxDurationMs: 1000
      })
    ).toThrow();
  });

  it("rejects tools outside the evidence whitelist", () => {
    expect(() =>
      evidenceBundleSchema.parse({
        schemaVersion: 1,
        unitId: "unit:src/file.ts",
        items: [
          {
            id: "e_1",
            checkId: "check_1",
            source: "code_comment",
            arguments: {},
            content: "不应允许评论工具",
            contentHash: "sha256:invalid"
          }
        ],
        completeness: "complete"
      })
    ).toThrow();
  });

  it("rejects unauthorized reflection backfill tools", () => {
    expect(() =>
      reflectionResultSchema.parse({
        schemaVersion: 1,
        unitId: "unit:src/file.ts",
        candidates: [],
        backfillRequest: {
          checkId: "check_1",
          reason: "需要更多证据",
          allowedTool: "task_done",
          arguments: {}
        }
      })
    ).toThrow();
  });

  it("migrates a legacy review plan into the versioned global plan", () => {
    const parsed = reviewPlanSchema.parse({
      riskPoints: [
        {
          area: "鉴权",
          riskLevel: "high",
          reasoning: "权限判断发生变化"
        }
      ],
      reviewStrategy: "优先检查权限边界",
      estimatedComplexity: "high"
    });

    expect(parsed).toMatchObject({
      version: 1,
      riskAreas: [
        {
          id: "legacy-risk-1",
          area: "鉴权",
          relatedFiles: []
        }
      ],
      units: [],
      legacy: {
        reviewStrategy: "优先检查权限边界",
        estimatedComplexity: "high"
      }
    });
  });

  it("migrates every valid legacy string value including empty strings", () => {
    const parsed = reviewPlanSchema.parse({
      riskPoints: [
        {
          area: "",
          riskLevel: "low",
          reasoning: ""
        }
      ],
      reviewStrategy: "",
      estimatedComplexity: "low"
    });

    expect(parsed.riskAreas[0]?.area).not.toBe("");
    expect(parsed.riskAreas[0]?.reasoning).not.toBe("");
    expect(parsed.legacy).toMatchObject({
      riskPoints: [{ area: "", reasoning: "" }],
      reviewStrategy: ""
    });
  });

  it("does not downgrade a malformed current plan to the legacy schema", () => {
    expect(() =>
      reviewPlanSchema.parse({
        version: 0,
        riskPoints: [],
        reviewStrategy: "旧策略",
        estimatedComplexity: "low"
      })
    ).toThrow();
  });

  it("rejects a revision whose previousVersion is not lower than version", () => {
    expect(() =>
      reviewPlanSchema.parse({
        version: 2,
        changeSetSummary: {
          files: [],
          totalInsertions: 0,
          totalDeletions: 0
        },
        riskAreas: [],
        units: [],
        revision: {
          reason: "重新评估风险",
          previousVersion: 2
        }
      })
    ).toThrow();
  });
});
