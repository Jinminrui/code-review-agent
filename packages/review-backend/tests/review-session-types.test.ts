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
