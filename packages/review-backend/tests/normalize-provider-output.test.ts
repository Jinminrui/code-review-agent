/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
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
