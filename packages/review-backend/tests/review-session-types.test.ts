import { describe, expect, it } from "vitest";
import { reviewFindingSchema, reviewSessionInputSchema } from "../src/index.js";

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
