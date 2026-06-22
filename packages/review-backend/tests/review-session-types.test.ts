import { describe, expect, it } from "vitest";
import { reviewFindingSchema, reviewSessionInputSchema } from "../src/index.js";
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
});
