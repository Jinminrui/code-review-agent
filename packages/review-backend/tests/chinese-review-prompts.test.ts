/**
 * 模块职责：验证审查模型的用户可见文本提示始终要求使用中文。
 */
import { describe, expect, it } from "vitest";
import { buildReviewPlanMessages } from "../src/infrastructure/llm/review-stage-prompts.js";
import { buildReviewReflectionMessages } from "../src/infrastructure/llm/reflection-provider.js";

describe("审查模型中文提示", () => {
  it("要求 Plan 阶段生成中文描述", () => {
    const systemPrompt = buildReviewPlanMessages({
      preAnalysis: {
        files: [],
        totals: { filesChanged: 0, insertions: 0, deletions: 0 },
        sensitivePathHints: []
      },
      diffSummary: "",
      allowedFiles: []
    })[0]?.content ?? "";

    expect(systemPrompt).toContain("必须使用中文");
  });

  it("要求 Reflection 阶段生成中文 finding 文案", () => {
    const systemPrompt = buildReviewReflectionMessages({
      unit: {
        unitId: "unit-1",
        file: "src/a.ts",
        order: 0,
        checks: [{
          id: "check-1",
          description: "检查变更",
          completionCriteria: ["完成检查"],
          allowedFiles: ["src/a.ts"],
          evidenceTargets: ["变更代码"]
        }],
        budget: { modelCalls: 1, toolCalls: 0, maxReadBytes: 0, maxInputTokens: 1, maxOutputTokens: 1, maxDurationMs: 1 }
      },
      evidenceBundle: { schemaVersion: 1, unitId: "unit-1", completeness: "complete", items: [] },
      candidateContext: {}
    })[0]?.content ?? "";

    expect(systemPrompt).toContain("所有 finding 的 summary、explanation、evidence 和 suggestion 必须使用中文");
  });
});
