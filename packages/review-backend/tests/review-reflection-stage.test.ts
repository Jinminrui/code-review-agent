import { describe, expect, it, vi } from "vitest";
import type { LlmProvider, ProviderCapabilities } from "../src/domain/provider.js";
import type { EvidenceBundle } from "../src/domain/review-evidence.js";
import type { ReviewFinding } from "../src/domain/review-finding.js";
import type { ReviewPlan } from "../src/domain/review-plan.js";
import { runReviewReflectionStage } from "../src/application/review-reflection-stage.js";
import { PlanAuthorizer } from "../src/infrastructure/llm/plan-authorizer.js";
import type { ToolExecutorContext } from "../src/infrastructure/llm/tool-executors.js";

type ReviewUnit = ReviewPlan["units"][number];

const capabilities: ProviderCapabilities = {
  structuredOutput: true,
  toolCalling: true,
  usage: true,
  cancellation: true
};

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

function evidenceBundle(): EvidenceBundle {
  return {
    schemaVersion: 1,
    unitId: "unit-auth",
    completeness: "complete",
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
    confidenceSignals: [],
    status: "line-level",
    ...overrides
  };
}

function providerReturning(
  ...values: unknown[]
): Pick<LlmProvider, "id" | "capabilities" | "chat"> {
  return {
    id: "reflection-provider",
    capabilities,
    chat: vi.fn().mockImplementation(async () => ({
      content: JSON.stringify(values.shift()),
      toolCalls: [],
      usage: { inputTokens: 10, outputTokens: 5 }
    }))
  };
}

function authorizer(): PlanAuthorizer {
  const reviewUnit = unit();
  const check = reviewUnit.checks[0]!;
  return new PlanAuthorizer({
    checkId: check.id,
    allowedFiles: check.allowedFiles,
    evidenceTargets: check.evidenceTargets,
    budget: reviewUnit.budget
  });
}

function toolContext(): ToolExecutorContext {
  return {
    baseRef: "main",
    targetRef: "feature/auth",
    repositoryPath: "/repo",
    gitClient: {
      readFileAtRef: vi.fn().mockResolvedValue("export function authenticate() { return false; }"),
      lsFiles: vi.fn().mockResolvedValue(["src/auth.ts"]),
      grep: vi.fn().mockResolvedValue(["src/auth.ts:10:authenticate"]),
      readDiff: vi.fn().mockResolvedValue([]),
      readWorkspaceDiff: vi.fn().mockResolvedValue([])
    }
  };
}

describe("runReviewReflectionStage", () => {
  it("将文件子计划、EvidenceBundle 和候选上下文交给独立 provider，并返回版本化结果", async () => {
    const provider = providerReturning({
      schemaVersion: 1,
      unitId: "unit-auth",
      candidates: [
        {
          finding: finding(),
          evidenceIds: ["evidence-1"],
          counterEvidence: "未发现调用方兜底",
          decision: "accept",
          decisionReason: "diff 直接支持该问题"
        }
      ]
    });

    const result = await runReviewReflectionStage({
      unit: unit(),
      evidenceBundle: evidenceBundle(),
      candidateContext: { source: "react", notes: ["检查失败分支"] },
      provider,
      toolExecutorContext: toolContext()
    });

    expect(result.status).toBe("completed");
    if (result.status === "reflection-failed") throw new Error("Reflection 不应失败");
    expect(result.reflectionResult).toMatchObject({
      schemaVersion: 1,
      unitId: "unit-auth",
      candidates: [{ decision: "accept", evidenceIds: ["evidence-1"] }]
    });
    const request = vi.mocked(provider.chat).mock.calls[0]![0];
    expect(request.jsonMode).toBe(true);
    expect(request.tools).toBeUndefined();
    expect(request.messages.map((message) => message.role)).toEqual(["system", "user"]);
    const userMessage = request.messages[1];
    expect(userMessage?.role).toBe("user");
    if (userMessage?.role !== "user") throw new Error("缺少 Reflection 用户消息");
    expect(JSON.parse(userMessage.content)).toMatchObject({
      stage: "file-reflection",
      unit: { unitId: "unit-auth" },
      evidenceBundle: { unitId: "unit-auth" },
      candidateContext: { source: "react" }
    });
  });

  it.each([{ evidenceIds: [] }, { evidenceIds: ["missing-evidence"] }])(
    "将没有有效证据引用的 accept 候选转入 needs-review：%j",
    async ({ evidenceIds }) => {
      const provider = providerReturning({
        schemaVersion: 1,
        unitId: "unit-auth",
        candidates: [
          {
            finding: finding(),
            evidenceIds,
            counterEvidence: "",
            decision: "accept",
            decisionReason: "模型认为成立"
          }
        ]
      });

      const result = await runReviewReflectionStage({
        unit: unit(),
        evidenceBundle: evidenceBundle(),
        candidateContext: {},
        provider,
        toolExecutorContext: toolContext()
      });

      if (result.status === "reflection-failed") throw new Error("Reflection 不应失败");
      expect(result.reflectionResult.candidates[0]).toMatchObject({
        decision: "needs-review"
      });
      expect(result.reflectionResult.candidates[0]!.decisionReason).toContain("有效证据");
    }
  );

  const backfillResult = (
    calls: Array<Record<string, unknown>>,
    candidates: unknown[] = []
  ) => ({
      schemaVersion: 1,
      unitId: "unit-auth",
      candidates,
      backfillRequest: {
        checkId: "check-auth",
        reason: "需要补充证据",
        allowedTool: "file_read" as const,
        arguments: { calls }
      }
    });

  it("一次 backfillRequest 最多执行三个工具调用，并拒绝第二个独立请求", async () => {
    const firstRequest = backfillResult([
      { allowedTool: "file_read", arguments: { path: "src/auth.ts", start_line: 1, end_line: 1 } },
      { allowedTool: "file_read", arguments: { path: "src/auth.ts", start_line: 2, end_line: 2 } },
      { allowedTool: "file_read", arguments: { path: "src/auth.ts", start_line: 3, end_line: 3 } }
    ]);
    const secondRequest = backfillResult([
      { allowedTool: "file_read", arguments: { path: "src/auth.ts", start_line: 4, end_line: 4 } }
    ]);
    const provider = providerReturning(firstRequest, secondRequest);
    const sameAuthorizer = authorizer();
    const authorizeSpy = vi.spyOn(sameAuthorizer, "authorize");

    const result = await runReviewReflectionStage({
      unit: unit(),
      evidenceBundle: evidenceBundle(),
      candidateContext: {},
      provider,
      authorizer: sameAuthorizer,
      toolExecutorContext: toolContext()
    });

    expect(result.status).toBe("evidence-incomplete");
    if (result.status === "reflection-failed") throw new Error("Reflection 不应失败");
    expect(result.backfill).toEqual({
      requested: true,
      requestCount: 1,
      toolCalls: 3,
      requestDenied: true
    });
    expect(authorizeSpy).toHaveBeenCalledTimes(3);
    expect(sameAuthorizer.getUsage().toolCalls).toBe(3);
    expect(result.evidenceBundle.items).toHaveLength(4);
    expect(result.evidenceBundle.items[1]).toMatchObject({
      checkId: "check-auth",
      source: "file_read",
      arguments: { path: "src/auth.ts", start_line: 1, end_line: 1 }
    });
    expect(result.reflectionResult.backfillRequest).toBeDefined();
    expect(result.backfill.toolCalls).toBe(3);
    expect(vi.mocked(provider.chat)).toHaveBeenCalledTimes(2);
  });

  it("重复读取命中 PlanAuthorizer cache 时不增加真实工具计数或重复 evidence", async () => {
    const provider = providerReturning(
      backfillResult([
        { allowedTool: "file_read", arguments: { path: "src/auth.ts" } },
        { allowedTool: "file_read", arguments: { path: "src/auth.ts" } },
        { allowedTool: "file_read", arguments: { path: "src/auth.ts", start_line: 2, end_line: 2 } }
      ]),
      { schemaVersion: 1, unitId: "unit-auth", candidates: [] }
    );
    const sameAuthorizer = authorizer();
    const authorizeSpy = vi.spyOn(sameAuthorizer, "authorize");

    const result = await runReviewReflectionStage({
      unit: unit(),
      evidenceBundle: evidenceBundle(),
      candidateContext: {},
      provider,
      authorizer: sameAuthorizer,
      toolExecutorContext: toolContext()
    });

    expect(result.status).toBe("completed");
    if (result.status === "reflection-failed") throw new Error("Reflection 不应失败");
    expect(authorizeSpy).toHaveBeenCalledTimes(3);
    expect(sameAuthorizer.getUsage().toolCalls).toBe(2);
    expect(result.backfill).toMatchObject({ requestCount: 1, toolCalls: 2 });
    expect(result.evidenceBundle.items).toHaveLength(3);
  });

  it("后续授权拒绝时保留批次内前序 evidence 和真实工具计数", async () => {
    const provider = providerReturning(
      backfillResult([
        { allowedTool: "file_read", arguments: { path: "src/auth.ts" } },
        { allowedTool: "file_read", arguments: { path: "src/private.ts" } }
      ])
    );
    const sameAuthorizer = authorizer();

    const result = await runReviewReflectionStage({
      unit: unit(),
      evidenceBundle: evidenceBundle(),
      candidateContext: {},
      provider,
      authorizer: sameAuthorizer,
      toolExecutorContext: toolContext()
    });

    expect(result.status).toBe("evidence-incomplete");
    if (result.status === "reflection-failed") throw new Error("Reflection 不应失败");
    expect(result.backfill).toMatchObject({ requestCount: 1, toolCalls: 1 });
    expect(result.evidenceBundle.items).toHaveLength(2);
    expect(result.evidenceBundle.items[1]).toMatchObject({
      arguments: { path: "src/auth.ts" }
    });
    expect(sameAuthorizer.getUsage().toolCalls).toBe(1);
    expect(result.backfillError).toMatchObject({ code: "file-not-authorized" });
  });

  it("后续 executor error 时保留前序 evidence，并计入已执行的失败调用", async () => {
    const provider = providerReturning(
      backfillResult([
        { allowedTool: "file_read", arguments: { path: "src/auth.ts" } },
        { allowedTool: "file_read", arguments: { path: "src/auth.ts", start_line: 2, end_line: 2 } }
      ])
    );
    const sameAuthorizer = authorizer();
    const context = toolContext();
    const readFileAtRef = vi.mocked(context.gitClient.readFileAtRef);
    readFileAtRef
      .mockResolvedValueOnce("first evidence")
      .mockRejectedValueOnce(new Error("read failed"));

    const result = await runReviewReflectionStage({
      unit: unit(),
      evidenceBundle: evidenceBundle(),
      candidateContext: {},
      provider,
      authorizer: sameAuthorizer,
      toolExecutorContext: context
    });

    expect(result.status).toBe("evidence-incomplete");
    if (result.status === "reflection-failed") throw new Error("Reflection 不应失败");
    expect(result.backfill).toMatchObject({ requestCount: 1, toolCalls: 2 });
    expect(result.evidenceBundle.items).toHaveLength(2);
    expect(result.evidenceBundle.items[1]).toMatchObject({
      arguments: { path: "src/auth.ts" },
      content: "first evidence"
    });
    expect(sameAuthorizer.getUsage().toolCalls).toBe(2);
    expect(result.backfillError).toMatchObject({ code: "backfill-tool-error" });
  });

  it("provider 不支持 structured output 时直接失败且不产生候选 finding", async () => {
    const supportedProvider = providerReturning({
      schemaVersion: 1,
      unitId: "unit-auth",
      candidates: [{ finding: finding(), evidenceIds: ["evidence-1"] }]
    });
    const provider: Pick<LlmProvider, "id" | "capabilities" | "chat"> = {
      ...supportedProvider,
      capabilities: { ...capabilities, structuredOutput: false }
    };

    const result = await runReviewReflectionStage({
      unit: unit(),
      evidenceBundle: evidenceBundle(),
      candidateContext: {},
      provider,
      toolExecutorContext: toolContext()
    });

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: { code: "structured-output-unsupported" }
    });
    expect(result).not.toHaveProperty("reflectionResult");
    expect(vi.mocked(provider.chat)).not.toHaveBeenCalled();
  });
});
