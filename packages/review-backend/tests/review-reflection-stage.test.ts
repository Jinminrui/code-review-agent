/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { describe, expect, it, vi } from "vitest";
import type { LlmProvider, ProviderCapabilities } from "../src/domain/provider.js";
import type { EvidenceBundle } from "../src/domain/review-evidence.js";
import type { ReviewFinding } from "../src/domain/review-finding.js";
import type { ReviewPlan } from "../src/domain/review-plan.js";
import { runGlobalReviewReflectionStage } from "../src/application/global-review-reflection-stage.js";
import { runReviewReflectionStage } from "../src/application/review-reflection-stage.js";
import { buildReviewReflectionMessages } from "../src/infrastructure/llm/reflection-provider.js";
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

function globalPlan(): ReviewPlan {
  return {
    version: 1,
    changeSetSummary: {
      files: ["src/auth.ts", "src/client.ts"],
      totalInsertions: 8,
      totalDeletions: 2
    },
    riskAreas: [
      {
        id: "risk-contract",
        area: "认证返回值契约",
        riskLevel: "high",
        reasoning: "生产方和消费方同时变更",
        relatedFiles: ["src/auth.ts", "src/client.ts"]
      }
    ],
    units: [
      unit(),
      {
        unitId: "unit-client",
        file: "src/client.ts",
        order: 1,
        checks: [
          {
            id: "check-client",
            description: "检查认证返回值消费逻辑",
            completionCriteria: ["确认消费方与认证契约一致"],
            allowedFiles: ["src/client.ts"],
            evidenceTargets: ["authenticate"]
          }
        ],
        budget: unit().budget
      }
    ]
  };
}

function reflectionCandidate(
  reviewFinding: ReviewFinding,
  evidenceIds: string[],
  decision: "accept" | "reject" | "needs-review" = "accept",
  decisionReason = "文件级证据支持"
) {
  return {
    finding: reviewFinding,
    evidenceIds,
    counterEvidence: "未发现反例",
    decision,
    decisionReason
  };
}

function globalStageInput(provider: Pick<LlmProvider, "id" | "capabilities" | "chat">) {
  const authFinding = finding({
    id: "finding-contract-auth",
    severity: "medium",
    summary: "认证返回值契约不一致"
  });
  const clientFinding = finding({
    id: "finding-contract-client",
    severity: "low",
    file: "src/client.ts",
    startLine: 20,
    endLine: 20,
    summary: "客户端仍按旧认证契约处理"
  });

  return {
    reviewPlan: globalPlan(),
    fileResults: [
      {
        unitId: "unit-auth",
        reflectionResult: {
          schemaVersion: 1 as const,
          unitId: "unit-auth",
          candidates: [reflectionCandidate(authFinding, ["evidence-auth"])]
        },
        findings: [authFinding]
      },
      {
        unitId: "unit-client",
        reflectionResult: {
          schemaVersion: 1 as const,
          unitId: "unit-client",
          candidates: [reflectionCandidate(clientFinding, ["evidence-client"])]
        },
        findings: [clientFinding]
      }
    ],
    evidenceSummaries: [
      {
        schemaVersion: 1 as const,
        unitId: "unit-auth",
        completeness: "complete" as const,
        items: [
          {
            id: "evidence-auth",
            checkId: "check-auth",
            source: "file_read_diff" as const,
            contentHash: "sha256:auth",
            summary: "认证函数改为返回 false"
          }
        ]
      },
      {
        schemaVersion: 1 as const,
        unitId: "unit-client",
        completeness: "complete" as const,
        items: [
          {
            id: "evidence-client",
            checkId: "check-client",
            source: "file_read_diff" as const,
            contentHash: "sha256:client",
            summary: "客户端仍将认证结果当作用户对象"
          }
        ]
      }
    ],
    provider
  };
}

function addFileUnadoptedCandidates(input: ReturnType<typeof globalStageInput>) {
  const rejectedFinding = finding({
    id: "finding-file-rejected",
    summary: "文件级已确认不成立"
  });
  const needsReviewFinding = finding({
    id: "finding-file-needs-review",
    summary: "文件级仍需人工确认"
  });
  input.fileResults[0]!.reflectionResult.candidates.push(
    reflectionCandidate(rejectedFinding, ["evidence-auth"], "reject", "文件级反例成立"),
    reflectionCandidate(
      needsReviewFinding,
      ["evidence-auth"],
      "needs-review",
      "文件级证据不足"
    )
  );
  return ["finding-file-rejected", "finding-file-needs-review"];
}

describe("runReviewReflectionStage", () => {
  it("prompt 明确要求通过工具提交最小合法的 ReflectionResult", () => {
    const systemMessage = buildReviewReflectionMessages({
      unit: unit(),
      evidenceBundle: evidenceBundle(),
      candidateContext: {}
    })[0];

    expect(systemMessage?.role).toBe("system");
    expect(systemMessage?.content).toContain("只调用 submit_review_reflection 工具");
    expect(systemMessage?.content).toContain('"schemaVersion":1');
    expect(systemMessage?.content).toContain('"candidates":[]');
    expect(systemMessage?.content).toContain("禁止把数字、数组或对象序列化成字符串");
  });

  it("Reflection 缺少 candidates 时重试一次并接受修复后的结果", async () => {
    const provider = providerReturning(
      { schemaVersion: 1, unitId: "unit-auth" },
      { schemaVersion: 1, unitId: "unit-auth", candidates: [] }
    );

    const result = await runReviewReflectionStage({
      unit: unit(),
      evidenceBundle: evidenceBundle(),
      candidateContext: {},
      provider,
      toolExecutorContext: toolContext()
    });

    expect(result.status).toBe("completed");
    expect(provider.chat).toHaveBeenCalledTimes(2);
  });

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
    expect(request.tools).toEqual([expect.objectContaining({ name: "submit_review_reflection" })]);
    expect(request.jsonMode).toBe(true);
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
      capabilities: { ...capabilities, toolCalling: false }
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

  it("EvidenceBundle schema 失败时返回合法的空 EvidenceBundle", async () => {
    const provider = providerReturning({ schemaVersion: 1, unitId: "unit-auth", candidates: [] });

    const result = await runReviewReflectionStage({
      unit: unit(),
      evidenceBundle: {} as EvidenceBundle,
      candidateContext: {},
      provider,
      toolExecutorContext: toolContext()
    });

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: { code: "invalid-input" },
      evidenceBundle: {
        schemaVersion: 1,
        unitId: "unit-auth",
        completeness: "incomplete",
        items: []
      }
    });
    expect(vi.mocked(provider.chat)).not.toHaveBeenCalled();
  });
});

describe("runGlobalReviewReflectionStage", () => {
  it("结合跨文件 Evidence 摘要识别契约风险并调整正式 finding severity", async () => {
    const provider = providerReturning({
      schemaVersion: 1,
      candidates: [
        reflectionCandidate(
          finding({
            id: "finding-contract-auth",
            severity: "high",
            summary: "认证返回值契约不一致"
          }),
          ["evidence-auth", "evidence-client"],
          "accept",
          "生产方和消费方的证据共同表明契约已断裂"
        )
      ]
    });

    const result = await runGlobalReviewReflectionStage(globalStageInput(provider));

    expect(result.status).toBe("completed");
    if (result.status === "reflection-failed") throw new Error("全局 Reflection 不应失败");
    expect(result.findings).toContainEqual(
      expect.objectContaining({ id: "finding-contract-auth", severity: "high" })
    );
    expect(result.reflectionResult).toMatchObject({
      schemaVersion: 1,
      candidates: [
        {
          finding: { id: "finding-contract-auth" },
          evidenceIds: ["evidence-auth", "evidence-client"],
          decision: "accept"
        }
      ]
    });
    const request = vi.mocked(provider.chat).mock.calls[0]![0];
    expect(request.tools).toEqual([expect.objectContaining({ name: "submit_global_review_reflection" })]);
    expect(request.jsonMode).toBe(true);
    const userMessage = request.messages[1];
    if (userMessage?.role !== "user") throw new Error("缺少全局 Reflection 用户消息");
    expect(JSON.parse(userMessage.content)).toMatchObject({
      stage: "global-reflection",
      reviewPlan: { version: 1 },
      fileResults: [
        { unitId: "unit-auth", findings: [{ id: "finding-contract-auth" }] },
        { unitId: "unit-client", findings: [{ id: "finding-contract-client" }] }
      ],
      evidenceSummaries: [
        { unitId: "unit-auth", items: [{ id: "evidence-auth" }] },
        { unitId: "unit-client", items: [{ id: "evidence-client" }] }
      ]
    });
  });

  it("合并同根因重复 finding，并将未采纳项保留为 ReflectionCandidate 轨迹", async () => {
    const input = globalStageInput(providerReturning());
    const [authResult, clientResult] = input.fileResults;
    const authFinding = authResult!.findings[0]!;
    const duplicateFinding = {
      ...clientResult!.findings[0]!,
      summary: authFinding.summary
    };
    clientResult!.findings = [duplicateFinding];
    clientResult!.reflectionResult.candidates = [
      reflectionCandidate(duplicateFinding, ["evidence-client"])
    ];
    input.provider = providerReturning({
      schemaVersion: 1,
      candidates: [
        reflectionCandidate(authFinding, ["evidence-auth"], "accept", "保留根因项"),
        reflectionCandidate(
          duplicateFinding,
          ["evidence-client"],
          "reject",
          "与 finding-contract-auth 属于同根因重复项"
        )
      ]
    });

    const result = await runGlobalReviewReflectionStage(input);

    if (result.status === "reflection-failed") throw new Error("全局 Reflection 不应失败");
    expect(result.findings.map((item) => item.id)).toEqual(["finding-contract-auth"]);
    expect(result.unadopted).toEqual([
      expect.objectContaining({
        finding: expect.objectContaining({ id: "finding-contract-client" }),
        decision: "reject",
        decisionReason: expect.stringContaining("同根因重复")
      })
    ]);
  });

  it("统一互相矛盾的整体 severity 决策", async () => {
    const input = globalStageInput(providerReturning());
    const [authFinding, clientFinding] = input.fileResults.flatMap((result) => result.findings);
    input.provider = providerReturning({
      schemaVersion: 1,
      candidates: [
        reflectionCandidate(
          { ...authFinding!, severity: "medium" },
          ["evidence-auth", "evidence-client"],
          "accept",
          "同一契约风险统一为 medium"
        ),
        reflectionCandidate(
          { ...clientFinding!, severity: "medium" },
          ["evidence-auth", "evidence-client"],
          "accept",
          "同一契约风险统一为 medium"
        )
      ]
    });

    const result = await runGlobalReviewReflectionStage(input);

    if (result.status === "reflection-failed") throw new Error("全局 Reflection 不应失败");
    expect(result.findings).toEqual([
      expect.objectContaining({ id: "finding-contract-auth", severity: "medium" }),
      expect.objectContaining({ id: "finding-contract-client", severity: "medium" })
    ]);
  });

  it("拒绝非全局 Reflection 提交工具的模型工具请求", async () => {
    const provider = providerReturning();
    vi.mocked(provider.chat).mockResolvedValueOnce({
      content: null,
      toolCalls: [
        {
          id: "tool-call-1",
          checkId: "check-auth",
          name: "file_read",
          arguments: { path: "src/auth.ts" }
        }
      ],
      usage: { inputTokens: 10, outputTokens: 5 }
    });
    const input = globalStageInput(provider);
    const expectedUnadoptedIds = addFileUnadoptedCandidates(input);

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: {
        code: "global-tool-request-denied",
        message: expect.stringContaining("不允许调用工具")
      },
      findings: input.fileResults.flatMap((fileResult) => fileResult.findings)
    });
    expect(result.unadopted.map((candidate) => candidate.finding.id)).toEqual(
      expectedUnadoptedIds
    );
    expect(vi.mocked(provider.chat).mock.calls[0]![0].tools).toEqual([
      expect.objectContaining({ name: "submit_global_review_reflection" })
    ]);
  });

  it("structured output 不支持时仍返回文件级未采纳轨迹", async () => {
    const supportedProvider = providerReturning();
    const provider: Pick<LlmProvider, "id" | "capabilities" | "chat"> = {
      ...supportedProvider,
      capabilities: { ...capabilities, toolCalling: false }
    };
    const input = globalStageInput(provider);
    const expectedUnadoptedIds = addFileUnadoptedCandidates(input);

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: { code: "structured-output-unsupported" }
    });
    expect(result.unadopted.map((candidate) => candidate.finding.id)).toEqual(
      expectedUnadoptedIds
    );
    expect(vi.mocked(provider.chat)).not.toHaveBeenCalled();
  });

  it("provider 返回非法结构化结果时仍返回文件级未采纳轨迹", async () => {
    const provider = providerReturning();
    vi.mocked(provider.chat).mockResolvedValueOnce({
      content: "not-json",
      toolCalls: []
    });
    const input = globalStageInput(provider);
    const expectedUnadoptedIds = addFileUnadoptedCandidates(input);

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: { code: "invalid-json" }
    });
    expect(result.unadopted.map((candidate) => candidate.finding.id)).toEqual(
      expectedUnadoptedIds
    );
  });

  it("将全局 Reflection JSON backfillRequest 作为结构化工具拒绝返回", async () => {
    const provider = providerReturning({
      schemaVersion: 1,
      candidates: [],
      backfillRequest: {
        checkId: "check-auth",
        reason: "需要读取更多文件",
        allowedTool: "file_read",
        arguments: { path: "src/auth.ts" }
      }
    });
    const input = globalStageInput(provider);
    const expectedUnadoptedIds = addFileUnadoptedCandidates(input);

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: {
        code: "global-tool-request-denied",
        message: expect.stringContaining("backfillRequest")
      }
    });
    expect(result.unadopted.map((candidate) => candidate.finding.id)).toEqual(
      expectedUnadoptedIds
    );
  });

  it("拒绝新增没有文件级 evidence 支持的 finding，且不扩大正式 finding 范围", async () => {
    const unsupportedFinding = finding({
      id: "finding-hallucinated",
      file: "src/admin.ts",
      summary: "未审查文件存在权限绕过"
    });
    const provider = providerReturning({
      schemaVersion: 1,
      candidates: [
        reflectionCandidate(
          unsupportedFinding,
          ["evidence-missing"],
          "accept",
          "模型尝试新增问题"
        )
      ]
    });
    const input = globalStageInput(provider);

    const result = await runGlobalReviewReflectionStage(input);

    if (result.status === "reflection-failed") throw new Error("全局 Reflection 不应失败");
    expect(result.findings).toEqual(
      input.fileResults.flatMap((fileResult) => fileResult.findings)
    );
    expect(result.findings).not.toContainEqual(
      expect.objectContaining({ id: "finding-hallucinated" })
    );
    expect(result.unadopted).toEqual([
      expect.objectContaining({
        finding: expect.objectContaining({ id: "finding-hallucinated" }),
        decision: "reject",
        decisionReason: expect.stringContaining("文件级 evidence")
      })
    ]);
  });

  it("将文件级未采纳候选合并进全局未采纳轨迹", async () => {
    const provider = providerReturning({ schemaVersion: 1, candidates: [] });
    const input = globalStageInput(provider);
    const deferredFinding = finding({
      id: "finding-file-needs-review",
      summary: "认证失败分支仍需人工确认"
    });
    input.fileResults[0]!.reflectionResult.candidates.push(
      reflectionCandidate(
        deferredFinding,
        ["evidence-auth"],
        "needs-review",
        "文件级反例不足"
      )
    );

    const result = await runGlobalReviewReflectionStage(input);

    if (result.status === "reflection-failed") throw new Error("全局 Reflection 不应失败");
    expect(result.unadopted).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({ id: "finding-file-needs-review" }),
        decision: "needs-review",
        decisionReason: "文件级反例不足"
      })
    );
  });

  it("重复 finding id 不得覆盖另一文件 finding，并将冲突项转入 needs-review", async () => {
    const provider = providerReturning({ schemaVersion: 1, candidates: [] });
    const input = globalStageInput(provider);
    const duplicatedId = input.fileResults[0]!.findings[0]!.id;
    const clientFinding = {
      ...input.fileResults[1]!.findings[0]!,
      id: duplicatedId
    };
    input.fileResults[1]!.findings = [clientFinding];
    input.fileResults[1]!.reflectionResult.candidates = [
      reflectionCandidate(clientFinding, ["evidence-client"])
    ];

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: {
        code: "invalid-global-input",
        message: expect.stringContaining("finding id")
      }
    });
    expect(result.findings).not.toContainEqual(expect.objectContaining({ id: duplicatedId }));
    expect(
      result.unadopted
        .filter((candidate) => candidate.finding.id === duplicatedId)
        .map((candidate) => ({ file: candidate.finding.file, decision: candidate.decision }))
    ).toEqual([
      { file: "src/auth.ts", decision: "needs-review" },
      { file: "src/client.ts", decision: "needs-review" }
    ]);
    expect(vi.mocked(provider.chat)).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "Reflection unitId 与 fileResult 不一致",
      mutate: (input: ReturnType<typeof globalStageInput>) => {
        input.fileResults[1]!.reflectionResult.unitId = "unit-auth";
      }
    },
    {
      name: "fileResult unitId 不存在于全局计划",
      mutate: (input: ReturnType<typeof globalStageInput>) => {
        input.fileResults[1]!.unitId = "unit-missing";
        input.fileResults[1]!.reflectionResult.unitId = "unit-missing";
        input.evidenceSummaries[1]!.unitId = "unit-missing";
      }
    },
    {
      name: "Evidence 摘要与文件结果不是一一匹配",
      mutate: (input: ReturnType<typeof globalStageInput>) => {
        input.evidenceSummaries[1]!.unitId = "unit-auth";
      }
    },
    {
      name: "文件级候选引用了其他 unit 的 evidenceId",
      mutate: (input: ReturnType<typeof globalStageInput>) => {
        input.fileResults[1]!.reflectionResult.candidates[0]!.evidenceIds = ["evidence-auth"];
      }
    },
    {
      name: "Evidence id 在全局摘要中重复",
      mutate: (input: ReturnType<typeof globalStageInput>) => {
        input.evidenceSummaries[1]!.items[0]!.id = "evidence-auth";
        input.fileResults[1]!.reflectionResult.candidates[0]!.evidenceIds = ["evidence-auth"];
      }
    },
    {
      name: "Evidence checkId 不属于对应全局 unit",
      mutate: (input: ReturnType<typeof globalStageInput>) => {
        input.evidenceSummaries[1]!.items[0]!.checkId = "check-auth";
      }
    },
    {
      name: "fileResult finding 不属于对应全局 unit 文件范围",
      mutate: (input: ReturnType<typeof globalStageInput>) => {
        const misplacedFinding = {
          ...input.fileResults[1]!.findings[0]!,
          file: "src/admin.ts"
        };
        input.fileResults[1]!.findings = [misplacedFinding];
        input.fileResults[1]!.reflectionResult.candidates = [
          reflectionCandidate(misplacedFinding, ["evidence-client"])
        ];
      }
    }
  ])("拒绝跨对象契约错配：$name", async ({ mutate }) => {
    const provider = providerReturning({ schemaVersion: 1, candidates: [] });
    const input = globalStageInput(provider);
    mutate(input);

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: {
        code: "invalid-global-input",
        message: expect.stringContaining("全局 Reflection 输入契约")
      }
    });
    expect(vi.mocked(provider.chat)).not.toHaveBeenCalled();
  });

  it("拒绝跨文件 Reflection 候选复用同一 finding id", async () => {
    const provider = providerReturning({ schemaVersion: 1, candidates: [] });
    const input = globalStageInput(provider);
    const duplicatedCandidate = {
      ...input.fileResults[1]!.reflectionResult.candidates[0]!,
      finding: {
        ...input.fileResults[1]!.reflectionResult.candidates[0]!.finding,
        id: input.fileResults[0]!.reflectionResult.candidates[0]!.finding.id
      }
    };
    input.fileResults[1]!.reflectionResult.candidates.push(duplicatedCandidate);

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: {
        code: "invalid-global-input",
        message: expect.stringContaining("Reflection candidate finding id")
      }
    });
    expect(
      result.unadopted
        .filter((candidate) => candidate.finding.id === duplicatedCandidate.finding.id)
        .map((candidate) => candidate.decision)
    ).toEqual(["needs-review", "needs-review"]);
    expect(vi.mocked(provider.chat)).not.toHaveBeenCalled();
  });

  it("拒绝模型输出中的重复 finding id，不让后一个决策覆盖前一个", async () => {
    const input = globalStageInput(providerReturning());
    const authFinding = input.fileResults[0]!.findings[0]!;
    input.provider = providerReturning({
      schemaVersion: 1,
      candidates: [
        reflectionCandidate(
          { ...authFinding, severity: "high" },
          ["evidence-auth"],
          "accept",
          "第一个决策"
        ),
        reflectionCandidate(
          { ...authFinding, severity: "low" },
          ["evidence-auth"],
          "accept",
          "冲突的第二个决策"
        )
      ]
    });

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: {
        code: "invalid-result",
        message: expect.stringContaining("finding id")
      }
    });
    expect(result.findings).toEqual(
      input.fileResults.flatMap((fileResult) => fileResult.findings)
    );
    expect(
      result.unadopted
        .filter((candidate) => candidate.finding.id === authFinding.id)
        .map((candidate) => candidate.decision)
    ).toEqual(["needs-review", "needs-review"]);
  });

  it.each([
    {
      name: "file",
      mutate: (reviewFinding: ReviewFinding) => ({
        ...reviewFinding,
        file: "src/admin.ts"
      })
    },
    {
      name: "line",
      mutate: (reviewFinding: ReviewFinding) => ({
        ...reviewFinding,
        startLine: 999,
        endLine: 999
      })
    },
    {
      name: "summary",
      mutate: (reviewFinding: ReviewFinding) => ({
        ...reviewFinding,
        summary: "篡改后的问题范围"
      })
    }
  ])("拒绝模型篡改既有 finding 的 $name", async ({ mutate }) => {
    const input = globalStageInput(providerReturning());
    const baseline = input.fileResults[0]!.findings[0]!;
    input.provider = providerReturning({
      schemaVersion: 1,
      candidates: [
        reflectionCandidate(
          mutate(baseline),
          ["evidence-auth"],
          "accept",
          "尝试扩大既有 finding 范围"
        )
      ]
    });

    const result = await runGlobalReviewReflectionStage(input);

    if (result.status === "reflection-failed") throw new Error("全局 Reflection 不应失败");
    expect(result.findings).toContainEqual(baseline);
    expect(result.reflectionResult.candidates[0]).toMatchObject({
      finding: { id: baseline.id },
      decision: "reject",
      decisionReason: expect.stringContaining("禁止新增或扩大范围")
    });
    expect(result.unadopted).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({ id: baseline.id }),
        decision: "reject"
      })
    );
  });

  it("将普通语义矛盾 finding 的全局决策应用到正式结果和未采纳轨迹", async () => {
    const input = globalStageInput(providerReturning());
    const authFinding = {
      ...input.fileResults[0]!.findings[0]!,
      summary: "认证失败后仍继续执行受保护请求"
    };
    const clientFinding = {
      ...input.fileResults[1]!.findings[0]!,
      summary: "认证失败后请求已被立即终止"
    };
    input.fileResults[0]!.findings = [authFinding];
    input.fileResults[0]!.reflectionResult.candidates = [
      reflectionCandidate(authFinding, ["evidence-auth"])
    ];
    input.fileResults[1]!.findings = [clientFinding];
    input.fileResults[1]!.reflectionResult.candidates = [
      reflectionCandidate(clientFinding, ["evidence-client"])
    ];
    input.provider = providerReturning({
      schemaVersion: 1,
      candidates: [
        reflectionCandidate(
          authFinding,
          ["evidence-auth", "evidence-client"],
          "accept",
          "跨文件控制流支持该结论"
        ),
        reflectionCandidate(
          clientFinding,
          ["evidence-auth", "evidence-client"],
          "reject",
          "与实际跨文件控制流矛盾"
        )
      ]
    });

    const result = await runGlobalReviewReflectionStage(input);

    if (result.status === "reflection-failed") throw new Error("全局 Reflection 不应失败");
    expect(result.findings.map((reviewFinding) => reviewFinding.id)).toEqual([
      authFinding.id
    ]);
    expect(result.unadopted).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({ id: clientFinding.id }),
        decision: "reject",
        decisionReason: expect.stringContaining("矛盾")
      })
    );
  });

  it.each([
    {
      name: "fileResult",
      mutate: (input: ReturnType<typeof globalStageInput>) => {
        input.fileResults = input.fileResults.filter(
          (result) => result.unitId !== "unit-client"
        );
      }
    },
    {
      name: "Evidence 摘要",
      mutate: (input: ReturnType<typeof globalStageInput>) => {
        input.evidenceSummaries = input.evidenceSummaries.filter(
          (summary) => summary.unitId !== "unit-client"
        );
      }
    }
  ])("以 plan.units 为权威集合，缺少 unit 的 $name 时失败", async ({ mutate }) => {
    const provider = providerReturning({ schemaVersion: 1, candidates: [] });
    const input = globalStageInput(provider);
    mutate(input);

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: {
        code: "invalid-global-input",
        message: expect.stringContaining("unit-client")
      }
    });
    expect(vi.mocked(provider.chat)).not.toHaveBeenCalled();
  });

  it("拒绝跨 unit 重复 checkId，并将依赖歧义 evidence 的正式 finding 转入 needs-review", async () => {
    const provider = providerReturning({ schemaVersion: 1, candidates: [] });
    const input = globalStageInput(provider);
    input.reviewPlan.units[1]!.checks[0]!.id = "check-auth";
    input.evidenceSummaries[1]!.items[0]!.checkId = "check-auth";
    const affectedFindingIds = input.fileResults.flatMap((result) =>
      result.findings.map((reviewFinding) => reviewFinding.id)
    );

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: {
        code: "invalid-global-input",
        message: expect.stringContaining("checkId check-auth 不唯一")
      }
    });
    expect(result.findings).not.toContainEqual(
      expect.objectContaining({ id: expect.stringMatching(/^finding-contract-/) })
    );
    expect(
      result.unadopted
        .filter((candidate) => affectedFindingIds.includes(candidate.finding.id))
        .map((candidate) => candidate.decision)
    ).toEqual(["needs-review", "needs-review"]);
    expect(vi.mocked(provider.chat)).not.toHaveBeenCalled();
  });

  it("同 ID baseline finding 与文件级 candidate 内容不一致时转入 needs-review", async () => {
    const provider = providerReturning({ schemaVersion: 1, candidates: [] });
    const input = globalStageInput(provider);
    const baseline = input.fileResults[0]!.findings[0]!;
    input.fileResults[0]!.findings = [
      { ...baseline, summary: "被跨层篡改的正式 finding 摘要" }
    ];

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: {
        code: "invalid-global-input",
        message: expect.stringContaining("baseline finding")
      }
    });
    expect(result.findings).not.toContainEqual(expect.objectContaining({ id: baseline.id }));
    expect(result.unadopted).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({
          id: baseline.id,
          summary: "被跨层篡改的正式 finding 摘要"
        }),
        decision: "needs-review",
        decisionReason: expect.stringContaining("内容不一致")
      })
    );
    expect(vi.mocked(provider.chat)).not.toHaveBeenCalled();
  });

  it("授权文件校验失败时移除越权正式 finding，并保留 needs-review 原因", async () => {
    const provider = providerReturning({ schemaVersion: 1, candidates: [] });
    const input = globalStageInput(provider);
    const baseline = input.fileResults[1]!.findings[0]!;
    const unauthorizedFinding = { ...baseline, file: "src/admin.ts" };
    input.fileResults[1]!.findings = [unauthorizedFinding];
    input.fileResults[1]!.reflectionResult.candidates = [
      reflectionCandidate(unauthorizedFinding, ["evidence-client"])
    ];

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: { code: "invalid-global-input" }
    });
    expect(result.findings).not.toContainEqual(
      expect.objectContaining({ id: unauthorizedFinding.id })
    );
    expect(result.unadopted).toContainEqual(
      expect.objectContaining({
        finding: unauthorizedFinding,
        decision: "needs-review",
        decisionReason: expect.stringContaining("不属于对应 unit 范围")
      })
    );
    expect(vi.mocked(provider.chat)).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "ReflectionResult.unitId 与 fileResult.unitId 错配",
      mutate: (input: ReturnType<typeof globalStageInput>) => {
        input.fileResults[0]!.reflectionResult.unitId = "unit-client";
      }
    },
    {
      name: "同一 unit 存在重复 fileResult",
      mutate: (input: ReturnType<typeof globalStageInput>) => {
        input.fileResults.push({
          ...input.fileResults[0]!,
          reflectionResult: {
            ...input.fileResults[0]!.reflectionResult,
            candidates: []
          },
          findings: []
        });
      }
    },
    {
      name: "全局计划存在重复 unit",
      mutate: (input: ReturnType<typeof globalStageInput>) => {
        input.reviewPlan.units.push({
          ...input.reviewPlan.units[0]!,
          checks: []
        });
      }
    }
  ])("unit 无法唯一归属时安全降级：$name", async ({ mutate }) => {
    const provider = providerReturning({ schemaVersion: 1, candidates: [] });
    const input = globalStageInput(provider);
    const f1 = { ...input.fileResults[0]!.findings[0]!, id: "f1" };
    input.fileResults[0]!.findings = [f1];
    input.fileResults[0]!.reflectionResult.candidates = [
      reflectionCandidate(f1, ["evidence-auth"])
    ];
    mutate(input);

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: { code: "invalid-global-input" }
    });
    expect(result.findings).not.toContainEqual(expect.objectContaining({ id: "f1" }));
    expect(result.unadopted).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({ id: "f1" }),
        decision: "needs-review",
        decisionReason: expect.stringContaining("unit")
      })
    );
    expect(vi.mocked(provider.chat)).not.toHaveBeenCalled();
  });

  it("按稳定 finding 字段比较，允许路径规范化和合法 file-level 降级", async () => {
    const input = globalStageInput(providerReturning({ schemaVersion: 1, candidates: [] }));
    const baseline = {
      ...input.fileResults[0]!.findings[0]!,
      startLine: undefined,
      endLine: undefined,
      status: "file-level" as const
    };
    input.fileResults[0]!.findings = [baseline];
    const fileCandidate = {
      ...baseline,
      file: `./${baseline.file}`,
      startLine: 10,
      endLine: 10,
      status: "line-level" as const,
      explanation: "文件级归一化后的解释",
      evidence: "归一化 evidence",
      suggestion: "归一化建议",
      confidenceSignals: ["normalized"]
    };
    input.fileResults[0]!.reflectionResult.candidates = [
      reflectionCandidate(fileCandidate, ["evidence-auth"])
    ];
    input.provider = providerReturning({
      schemaVersion: 1,
      candidates: [reflectionCandidate(baseline, ["evidence-auth"])]
    });

    const result = await runGlobalReviewReflectionStage(input);

    expect(result.status).toBe("completed");
    if (result.status === "reflection-failed") throw new Error("全局 Reflection 不应失败");
    expect(result.findings).toContainEqual(expect.objectContaining({ id: baseline.id }));
  });

  it.each([
    { name: "reject", decision: "reject" as const, evidenceIds: ["evidence-auth"] },
    { name: "needs-review", decision: "needs-review" as const, evidenceIds: ["evidence-auth"] },
    { name: "无 evidence", decision: "accept" as const, evidenceIds: [] }
  ])("文件级 candidate $name 时不发布 baseline，并保留原始 decisionReason", async ({ decision, evidenceIds }) => {
    const input = globalStageInput(providerReturning({ schemaVersion: 1, candidates: [] }));
    const baseline = input.fileResults[0]!.findings[0]!;
    input.fileResults[0]!.reflectionResult.candidates = [
      reflectionCandidate(baseline, evidenceIds, decision, "文件级原始决策原因")
    ];

    const result = await runGlobalReviewReflectionStage(input);

    expect(result.status).toBe("completed");
    if (result.status === "reflection-failed") throw new Error("全局 Reflection 不应失败");
    expect(result.findings).not.toContainEqual(expect.objectContaining({ id: baseline.id }));
    expect(result.unadopted).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({ id: baseline.id }),
        decision: decision === "reject" ? "reject" : "needs-review",
        decisionReason: expect.stringContaining("文件级原始决策原因")
      })
    );
  });

  it.each([
    {
      name: "空 unitId",
      input: () => {
        const value = globalStageInput(providerReturning({ schemaVersion: 1, candidates: [] }));
        value.fileResults[0]!.unitId = "";
        return value;
      }
    },
    {
      name: "非法对象",
      input: () => ({
        ...globalStageInput(providerReturning({ schemaVersion: 1, candidates: [] })),
        fileResults: [{}]
      })
    }
  ])("跨阶段 schema 错误 $name 结构化返回而不抛出 ZodError", async ({ input }) => {
    const result = await runGlobalReviewReflectionStage(input() as never);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: { code: "invalid-global-input" }
    });
    if (result.status !== "reflection-failed") throw new Error("schema 错误应失败");
    expect(result.error.message).not.toContain("ZodError");
  });

  it("全局契约失败时追加原因而不覆盖文件级 decisionReason", async () => {
    const input = globalStageInput(providerReturning({ schemaVersion: 1, candidates: [] }));
    const baseline = input.fileResults[0]!.findings[0]!;
    input.fileResults[0]!.reflectionResult = {
      ...input.fileResults[0]!.reflectionResult,
      unitId: "unit-client",
      candidates: [reflectionCandidate(baseline, ["evidence-auth"], "reject", "文件级原始原因")]
    };

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({ status: "reflection-failed", error: { code: "invalid-global-input" } });
    expect(result.unadopted).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({ id: baseline.id }),
        decisionReason: expect.stringMatching(/文件级原始原因.*unitId/)
      })
    );
  });

  it.each([
    "structured-output-unsupported",
    "provider-failed",
    "global-tool-request-denied"
  ] as const)("失败路径 %s 先过滤文件级 baseline", async (failure) => {
    const provider = providerReturning({ schemaVersion: 1, candidates: [] });
    const input = globalStageInput(provider);
    const authFinding = input.fileResults[0]!.findings[0]!;
    const clientFinding = input.fileResults[1]!.findings[0]!;
    input.fileResults[1]!.reflectionResult.candidates = [
      reflectionCandidate(clientFinding, ["evidence-client"], "reject", "客户端文件级拒绝")
    ];

    if (failure === "structured-output-unsupported") {
      input.provider = { ...provider, capabilities: { ...capabilities, toolCalling: false } };
    } else if (failure === "provider-failed") {
      vi.mocked(provider.chat).mockRejectedValueOnce(new Error("provider crashed"));
    } else {
      vi.mocked(provider.chat).mockResolvedValueOnce({
        content: null,
        toolCalls: [{ id: "tool", checkId: "check-auth", name: "file_read", arguments: {} }]
      });
    }

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({ status: "reflection-failed" });
    expect(result.findings).toEqual([authFinding]);
    expect(result.unadopted).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({ id: clientFinding.id }),
        decision: "reject",
        decisionReason: "客户端文件级拒绝"
      })
    );
  });

  it("重复全局 finding id 失败时过滤 baseline，并保留同批次其他候选轨迹", async () => {
    const input = globalStageInput(providerReturning());
    const authFinding = input.fileResults[0]!.findings[0]!;
    const clientFinding = input.fileResults[1]!.findings[0]!;
    input.fileResults[1]!.reflectionResult.candidates = [
      reflectionCandidate(clientFinding, ["evidence-client"], "accept")
    ];
    input.provider = providerReturning({
      schemaVersion: 1,
      candidates: [
        reflectionCandidate(authFinding, ["evidence-auth"], "accept", "第一次全局应用"),
        reflectionCandidate(authFinding, ["evidence-auth"], "accept", "重复全局应用"),
        reflectionCandidate(clientFinding, ["evidence-client"], "reject", "跨文件矛盾")
      ]
    });

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: { code: "invalid-result" }
    });
    expect(result.findings).toEqual(
      input.fileResults.flatMap((fileResult) => fileResult.findings)
    );
    expect(result.unadopted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ finding: expect.objectContaining({ id: authFinding.id }), decision: "needs-review" }),
        expect.objectContaining({
          finding: expect.objectContaining({ id: clientFinding.id }),
          decision: "needs-review",
          decisionReason: expect.stringContaining("跨文件矛盾")
        })
      ])
    );
  });

  it.each([
    {
      name: "candidate severity 改变",
      mutate: (baseline: ReviewFinding) => ({ ...baseline, severity: "high" as const })
    },
    {
      name: "baseline line-level 被 candidate 反向降级",
      mutate: (baseline: ReviewFinding) => ({
        ...baseline,
        startLine: undefined,
        endLine: undefined,
        status: "file-level" as const
      })
    }
  ])("严格拒绝单向稳定字段变化：$name", async ({ mutate }) => {
    const input = globalStageInput(providerReturning({ schemaVersion: 1, candidates: [] }));
    const baseline = input.fileResults[0]!.findings[0]!;
    const changed = mutate(baseline);
    input.fileResults[0]!.reflectionResult.candidates = [
      reflectionCandidate(changed, ["evidence-auth"])
    ];

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: { code: "invalid-global-input" }
    });
    expect(result.findings).not.toContainEqual(expect.objectContaining({ id: baseline.id }));
    expect(result.unadopted).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({ id: baseline.id }),
        decision: "needs-review",
        decisionReason: expect.stringContaining("内容不一致")
      })
    );
  });

  it("parseArray 部分元素失败时保留有效结果，并为坏元素生成 needs-review 轨迹", async () => {
    const input = globalStageInput(providerReturning({ schemaVersion: 1, candidates: [] }));
    input.fileResults = [input.fileResults[0]!, {} as never];

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: { code: "invalid-global-input" }
    });
    expect(result.findings).toContainEqual(
      expect.objectContaining({ id: "finding-contract-auth" })
    );
    expect(result.unadopted).toContainEqual(
      expect.objectContaining({
        decision: "needs-review",
        decisionReason: expect.stringContaining("fileResults[1]")
      })
    );
  });

  it("parseArray 部分失败时仍执行全局契约校验，不发布有效解析结果中的越权 finding", async () => {
    const input = globalStageInput(providerReturning({ schemaVersion: 1, candidates: [] }));
    const unauthorizedFinding = {
      ...input.fileResults[0]!.findings[0]!,
      file: "src/admin.ts"
    };
    input.fileResults[0]!.findings = [unauthorizedFinding];
    input.fileResults[0]!.reflectionResult.candidates = [
      reflectionCandidate(unauthorizedFinding, ["evidence-auth"])
    ];
    input.fileResults = [input.fileResults[0]!, {} as never];

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: { code: "invalid-global-input" }
    });
    expect(result.findings).not.toContainEqual(
      expect.objectContaining({ id: unauthorizedFinding.id })
    );
    expect(result.unadopted).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({ id: unauthorizedFinding.id }),
        decision: "needs-review",
        decisionReason: expect.stringContaining("不属于对应 unit 范围")
      })
    );
  });

  it("ReviewPlan schema 失败时 fail closed，不发布包括越权 finding 在内的任何 baseline", async () => {
    const input = globalStageInput(providerReturning({ schemaVersion: 1, candidates: [] }));
    const unauthorizedFinding = {
      ...input.fileResults[0]!.findings[0]!,
      file: "src/admin.ts"
    };
    input.fileResults[0]!.findings = [unauthorizedFinding];
    input.fileResults[0]!.reflectionResult.candidates = [
      reflectionCandidate(unauthorizedFinding, ["evidence-auth"])
    ];
    input.reviewPlan = {
      ...input.reviewPlan,
      units: [{}]
    } as never;

    const result = await runGlobalReviewReflectionStage(input);

    expect(result).toMatchObject({
      status: "reflection-failed",
      error: { code: "invalid-global-input" }
    });
    expect(result.findings).toEqual([]);
    expect(result.unadopted).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({ id: unauthorizedFinding.id }),
        decision: "needs-review",
        decisionReason: expect.stringContaining("ReviewPlan schema")
      })
    );
  });
});
