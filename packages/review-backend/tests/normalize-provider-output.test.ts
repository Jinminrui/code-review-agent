import { describe, expect, it } from "vitest";
import { normalizeProviderOutput } from "../src/infrastructure/llm/normalize-provider-output.js";

describe("normalizeProviderOutput", () => {
  it("converts JSON output into a review finding", () => {
    const findings = normalizeProviderOutput({
      content: JSON.stringify({
        findings: [
          {
            severity: "medium",
            category: "test-gap",
            summary: "缺少回归测试",
            explanation: "新增分支没有对应测试",
            file: "src/a.ts",
            startLine: 5,
            endLine: 7,
            confidenceSignals: ["diff-hit"]
          }
        ]
      }),
      fallbackFile: "src/a.ts"
    });

    expect(findings[0]?.status).toBe("line-level");
  });

  it("returns empty list for invalid JSON", () => {
    expect(normalizeProviderOutput({ content: "{}", fallbackFile: "src/a.ts" })).toEqual([]);
  });

  it("downgrades finding without line numbers", () => {
    const findings = normalizeProviderOutput({
      content: JSON.stringify({
        findings: [
          {
            severity: "low",
            category: "style",
            summary: "建议补充说明",
            explanation: "当前改动意图不够明显",
            confidenceSignals: []
          }
        ]
      }),
      fallbackFile: "src/a.ts"
    });

    expect(findings[0]?.status).toBe("file-level");
  });
});
