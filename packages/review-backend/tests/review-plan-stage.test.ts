/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { describe, expect, it, vi } from "vitest";
import type { LlmProvider } from "../src/domain/provider.js";
import type { ReviewPlan } from "../src/domain/review-plan.js";
import { buildReviewPreAnalysis } from "../src/application/review-pre-analysis.js";
import {
  generateReviewPlanStage,
  reviseReviewPlanStage
} from "../src/application/review-plan-stage.js";
import { buildReviewPlanMessages } from "../src/infrastructure/llm/review-stage-prompts.js";
import type { ParsedDiffFile } from "../src/infrastructure/git/parse-unified-diff.js";

type PlanProvider = Pick<LlmProvider, "id" | "chat">;

function diffFile(path: string, insertions = 1, deletions = 0): ParsedDiffFile {
  return {
    path,
    isNew: false,
    isDeleted: false,
    isBinary: false,
    insertions,
    deletions,
    hunks: []
  };
}

function providerReturning(payload: unknown): PlanProvider {
  return {
    id: "fake-plan-provider",
    chat: vi.fn().mockResolvedValue({
      content: typeof payload === "string" ? payload : JSON.stringify(payload),
      toolCalls: []
    })
  };
}

function validPlan(overrides: Partial<ReviewPlan> = {}): ReviewPlan {
  return {
    version: 1,
    changeSetSummary: {
      files: ["src/a.ts", "src/b.ts"],
      totalInsertions: 3,
      totalDeletions: 1
    },
    riskAreas: [
      {
        id: "risk-1",
        area: "输入边界",
        riskLevel: "high",
        reasoning: "新增输入分支",
        relatedFiles: ["src/a.ts"]
      }
    ],
    units: [
      {
        unitId: "unit-b",
        file: "src/b.ts",
        order: 20,
        checks: [
          {
            id: "check-b",
            description: "检查调用方契约",
            completionCriteria: ["确认调用方处理所有返回值"],
            allowedFiles: ["src/b.ts"],
            evidenceTargets: ["调用点"]
          }
        ],
        budget: {
          modelCalls: 2,
          toolCalls: 4,
          maxInputTokens: 8_000,
          maxOutputTokens: 2_000,
          maxReadBytes: 64_000,
          maxDurationMs: 60_000
        }
      },
      {
        unitId: "unit-a",
        file: "src/a.ts",
        order: 10,
        checks: [
          {
            id: "check-a",
            description: "检查输入校验",
            completionCriteria: ["确认空输入被拒绝"],
            allowedFiles: ["src/a.ts"],
            evidenceTargets: ["输入分支"]
          }
        ],
        budget: {
          modelCalls: 2,
          toolCalls: 4,
          maxInputTokens: 8_000,
          maxOutputTokens: 2_000,
          maxReadBytes: 64_000,
          maxDurationMs: 60_000
        }
      }
    ],
    ...overrides
  };
}

const preAnalysis = buildReviewPreAnalysis([
  diffFile("src/b.ts", 2, 1),
  diffFile("src/a.ts")
]);

describe("generateReviewPlanStage", () => {
  it("Plan prompt 要求只通过 submit_review_plan 工具提交最小合法计划", () => {
    const systemMessage = buildReviewPlanMessages({
      preAnalysis,
      diffSummary: "受控摘要",
      allowedFiles: ["src/a.ts"]
    })[0];

    expect(systemMessage?.role).toBe("system");
    expect(systemMessage?.content).toContain("只调用 submit_review_plan 工具");
    expect(systemMessage?.content).toContain("工具参数必须是 JSON 对象");
    expect(systemMessage?.content).toContain('"version":1');
    expect(systemMessage?.content).not.toContain("只返回 JSON 对象");
  });

  it("Plan schema 校验失败后重试一次并接受修复后的结构化结果", async () => {
    const provider = {
      id: "retry-plan-provider",
      chat: vi.fn()
        .mockResolvedValueOnce({ content: JSON.stringify({ version: "1" }), toolCalls: [] })
        .mockResolvedValueOnce({ content: JSON.stringify(validPlan()), toolCalls: [] })
    };

    const result = await generateReviewPlanStage({
      provider,
      preAnalysis,
      diffSummary: "受控摘要"
    });

    expect(result.status).toBe("planned");
    expect(provider.chat).toHaveBeenCalledTimes(2);
    expect(provider.chat.mock.calls[1]?.[0].messages.at(-1)?.content).toContain("直接调用 submit_review_plan 工具");
  });

  it("兼容 provider 将 Plan 顶层结构字段编码成字符串的返回", async () => {
    const plan = validPlan();
    const provider = {
      id: "encoded-plan-provider",
      chat: vi.fn().mockResolvedValue({
        content: null,
        toolCalls: [{
          id: "call-plan-1",
          name: "submit_review_plan",
          arguments: {
            version: "1",
            changeSetSummary: JSON.stringify(plan.changeSetSummary),
            riskAreas: JSON.stringify(plan.riskAreas),
            units: JSON.stringify(plan.units)
          }
        }]
      })
    };

    const result = await generateReviewPlanStage({
      provider,
      preAnalysis,
      diffSummary: "受控摘要"
    });

    expect(result.status).toBe("planned");
  });

  it("独立调用 provider，并按 order 稳定输出全局计划和文件子计划", async () => {
    const provider = providerReturning(validPlan());

    const result = await generateReviewPlanStage({
      provider,
      preAnalysis,
      diffSummary: "src/a.ts: 新增输入分支\nsrc/b.ts: 更新调用方"
    });

    expect(result.status).toBe("planned");
    expect(result.plan.version).toBe(1);
    expect(result.plan.units.map((unit) => unit.file)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(result.plan.units.map((unit) => unit.order)).toEqual([0, 1]);
    expect(provider.chat).toHaveBeenCalledOnce();
    expect(provider.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [expect.objectContaining({ name: "submit_review_plan" })],
        jsonMode: true,
        messages: [
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("src/a.ts: 新增输入分支")
          })
        ]
      })
    );
  });

  it("为未提供预算的合法计划补入确定性默认预算", async () => {
    const plan = validPlan() as unknown as { units: Array<Record<string, unknown>> };
    plan.units = plan.units.map(({ budget: _budget, ...unit }) => unit);

    const result = await generateReviewPlanStage({
      provider: providerReturning(plan),
      preAnalysis,
      diffSummary: "受控摘要"
    });

    expect(result.status).toBe("planned");
    expect(result.plan.units[0]?.budget).toEqual({
      modelCalls: 2,
      toolCalls: 8,
      maxInputTokens: 12_000,
      maxOutputTokens: 4_000,
      maxReadBytes: 128_000,
      maxDurationMs: 120_000
    });
  });

  it("非法 JSON 时显式降级到确定性最小计划", async () => {
    const result = await generateReviewPlanStage({
      provider: providerReturning("not-json"),
      preAnalysis,
      diffSummary: "受控摘要"
    });

    expect(result.status).toBe("plan-degraded");
    if (result.status !== "plan-degraded") {
      throw new Error("预期计划进入降级状态");
    }
    expect(result.error.code).toBe("invalid-json");
    expect(result.plan.units.map((unit) => unit.file)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(result.plan.units.every((unit) => unit.checks[0]!.completionCriteria.length > 0)).toBe(
      true
    );
  });

  it("缺少完成条件时显式返回结构化降级原因", async () => {
    const plan = validPlan();
    plan.units[0]!.checks[0]!.completionCriteria = [];

    const result = await generateReviewPlanStage({
      provider: providerReturning(plan),
      preAnalysis,
      diffSummary: "受控摘要"
    });

    expect(result.status).toBe("plan-degraded");
    if (result.status !== "plan-degraded") {
      throw new Error("预期计划进入降级状态");
    }
    expect(result.error).toMatchObject({
      code: "invalid-plan",
      message: expect.stringContaining("completionCriteria")
    });
  });

  it("引用未授权文件时显式降级", async () => {
    const plan = validPlan();
    plan.units[0]!.checks[0]!.allowedFiles.push("src/missing.ts");

    const result = await generateReviewPlanStage({
      provider: providerReturning(plan),
      preAnalysis,
      diffSummary: "受控摘要"
    });

    expect(result.status).toBe("plan-degraded");
    if (result.status !== "plan-degraded") {
      throw new Error("预期计划进入降级状态");
    }
    expect(result.error).toMatchObject({
      code: "file-out-of-scope",
      files: ["src/missing.ts"]
    });
  });

  it("全局变更摘要引用不存在文件时也显式降级", async () => {
    const plan = validPlan();
    plan.changeSetSummary.files.push("src/missing-summary.ts");

    const result = await generateReviewPlanStage({
      provider: providerReturning(plan),
      preAnalysis,
      diffSummary: "受控摘要"
    });

    expect(result.status).toBe("plan-degraded");
    if (result.status !== "plan-degraded") {
      throw new Error("预期计划进入降级状态");
    }
    expect(result.error).toMatchObject({
      code: "file-out-of-scope",
      files: ["src/missing-summary.ts"]
    });
  });
});

describe("reviseReviewPlanStage", () => {
  it.each(["file-missing", "dependency-disproven", "assumption-conflict"] as const)(
    "允许 %s 触发一次受限修订并记录版本",
    async (type) => {
      const currentPlan = validPlan();
      const revised = validPlan({
        version: 99,
        revision: { reason: "模型提供的不可信原因", previousVersion: 98 },
        units: [...validPlan().units].reverse()
      });

      const result = await reviseReviewPlanStage({
        provider: providerReturning(revised),
        preAnalysis,
        diffSummary: "受控摘要",
        currentPlan,
        trigger: { type, reason: `测试 ${type}` }
      });

      expect(result.status).toBe("planned");
      expect(result.plan.version).toBe(2);
      expect(result.plan.revision).toEqual({
        reason: `测试 ${type}`,
        previousVersion: 1
      });
      expect(result.plan.units.map((unit) => unit.file)).toEqual(["src/a.ts", "src/b.ts"]);
    }
  );

  it("拒绝第二次修订且不调用 provider", async () => {
    const provider = providerReturning(validPlan());
    const currentPlan = validPlan({
      version: 2,
      revision: { reason: "第一次修订", previousVersion: 1 }
    });

    const result = await reviseReviewPlanStage({
      provider,
      preAnalysis,
      diffSummary: "受控摘要",
      currentPlan,
      trigger: { type: "assumption-conflict", reason: "再次冲突" }
    });

    expect(result.status).toBe("revision-rejected");
    if (result.status !== "revision-rejected") {
      throw new Error("预期拒绝第二次修订");
    }
    expect(result.error.code).toBe("revision-limit-exceeded");
    expect(result.plan).toEqual(currentPlan);
    expect(provider.chat).not.toHaveBeenCalled();
  });

  it("拒绝 version 大于 1 但缺少合法 revision 的 currentPlan", async () => {
    const provider = providerReturning(validPlan());
    const currentPlan = validPlan({ version: 2 });

    const result = await reviseReviewPlanStage({
      provider,
      preAnalysis,
      diffSummary: "受控摘要",
      currentPlan,
      trigger: { type: "assumption-conflict", reason: "再次冲突" }
    });

    expect(result.status).toBe("revision-rejected");
    if (result.status !== "revision-rejected") {
      throw new Error("预期拒绝版本与修订元数据不一致的计划");
    }
    expect(result.error.code).toBe("revision-limit-exceeded");
    expect(result.plan).toEqual(currentPlan);
    expect(provider.chat).not.toHaveBeenCalled();
  });

  it("拒绝非白名单原因触发修订", async () => {
    const provider = providerReturning(validPlan());

    const result = await reviseReviewPlanStage({
      provider,
      preAnalysis,
      diffSummary: "受控摘要",
      currentPlan: validPlan(),
      trigger: { type: "model-requested", reason: "模型建议扩大检查" } as never
    });

    expect(result.status).toBe("revision-rejected");
    if (result.status !== "revision-rejected") {
      throw new Error("预期拒绝非法修订原因");
    }
    expect(result.error.code).toBe("revision-trigger-not-allowed");
    expect(provider.chat).not.toHaveBeenCalled();
  });

  it("在调用 provider 前拒绝 currentPlan 引用权威范围外文件", async () => {
    const provider = providerReturning(validPlan());
    const currentPlan = validPlan();
    currentPlan.units[0]!.checks[0]!.allowedFiles.push("src/missing.ts");

    const result = await reviseReviewPlanStage({
      provider,
      preAnalysis,
      diffSummary: "受控摘要",
      currentPlan,
      trigger: { type: "file-missing", reason: "计划引用文件不存在" }
    });

    expect(result.status).toBe("revision-rejected");
    if (result.status !== "revision-rejected") {
      throw new Error("预期拒绝包含越界文件的当前计划");
    }
    expect(result.error).toMatchObject({
      code: "revision-scope-expanded",
      files: ["src/missing.ts"]
    });
    expect(provider.chat).not.toHaveBeenCalled();
  });

  it("拒绝修订扩大原始变更集或已授权依赖范围", async () => {
    const expandedPlan = validPlan();
    expandedPlan.units[0]!.checks[0]!.allowedFiles.push("src/new-dependency.ts");

    const result = await reviseReviewPlanStage({
      provider: providerReturning(expandedPlan),
      preAnalysis,
      diffSummary: "受控摘要",
      authorizedDependencyFiles: ["src/existing-dependency.ts"],
      currentPlan: validPlan(),
      trigger: { type: "dependency-disproven", reason: "原依赖被证伪" }
    });

    expect(result.status).toBe("revision-rejected");
    if (result.status !== "revision-rejected") {
      throw new Error("预期拒绝扩大修订范围");
    }
    expect(result.error).toMatchObject({
      code: "revision-scope-expanded",
      files: ["src/new-dependency.ts"]
    });
  });
});
