/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { describe, expect, it, vi } from "vitest";
import type { LlmProvider } from "../src/domain/provider.js";
import type { ReviewPlan } from "../src/domain/review-plan.js";
import type { PhaseBudget } from "../src/domain/review-runtime.js";
import type { ToolCall } from "../src/domain/tool.js";
import { runReviewReactStage } from "../src/application/review-react-stage.js";
import { PlanAuthorizer } from "../src/infrastructure/llm/plan-authorizer.js";
import type { ToolExecutorContext } from "../src/infrastructure/llm/tool-executors.js";

type ReviewUnit = ReviewPlan["units"][number];

function unit(
  budgetOverrides: Partial<PhaseBudget> = {},
  checks: ReviewUnit["checks"] = [
    {
      id: "check-auth",
      description: "检查认证失败分支",
      completionCriteria: ["确认错误返回不会被忽略"],
      allowedFiles: ["src/auth.ts"],
      evidenceTargets: ["authenticate"]
    }
  ]
): ReviewUnit {
  return {
    unitId: "unit-auth",
    file: "src/auth.ts",
    order: 0,
    checks,
    budget: {
      modelCalls: 3,
      toolCalls: 3,
      maxInputTokens: 1_000,
      maxOutputTokens: 1_000,
      maxReadBytes: 10_000,
      maxDurationMs: 10_000,
      ...budgetOverrides
    }
  };
}

function authorizer(reviewUnit = unit()): PlanAuthorizer {
  const check = reviewUnit.checks[0]!;
  return new PlanAuthorizer({
    checkId: check.id,
    allowedFiles: check.allowedFiles,
    evidenceTargets: check.evidenceTargets,
    budget: reviewUnit.budget
  });
}

function authorizersFor(reviewUnit: ReviewUnit): ReadonlyMap<string, PlanAuthorizer> {
  return new Map(
    reviewUnit.checks.map((check) => [
      check.id,
      new PlanAuthorizer({
        checkId: check.id,
        allowedFiles: check.allowedFiles,
        evidenceTargets: check.evidenceTargets,
        budget: reviewUnit.budget
      })
    ])
  );
}

function toolContext(): ToolExecutorContext {
  return {
    baseRef: "main",
    targetRef: "feature/auth",
    repositoryPath: "/repo",
    gitClient: {
      readFileAtRef: vi.fn().mockResolvedValue("export function authenticate() { return false; }"),
      lsFiles: vi.fn().mockResolvedValue(["src/auth.ts"]),
      grep: vi.fn().mockResolvedValue(["src/auth.ts:1:authenticate"]),
      readDiff: vi.fn().mockResolvedValue([]),
      readWorkspaceDiff: vi.fn().mockResolvedValue([])
    }
  };
}

describe("runReviewReactStage", () => {
  it("连续执行授权只读工具并返回 EvidenceBundle，不生成 ReviewFinding", async () => {
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "fake-react-provider",
      chat: vi
        .fn()
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: "read-auth",
              name: "file_read",
              arguments: { path: "src/auth.ts" }
            }
          ],
          usage: { inputTokens: 10, outputTokens: 5 }
        })
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: "search-auth",
              name: "code_search",
              arguments: { pattern: "authenticate" }
            }
          ],
          usage: { inputTokens: 12, outputTokens: 5 }
        })
        .mockResolvedValueOnce({
          content: "证据收集完成",
          toolCalls: [],
          usage: { inputTokens: 8, outputTokens: 4 }
        })
    };

    const result = await runReviewReactStage({
      unit: unit(),
      authorizer: authorizer(),
      provider,
      toolExecutorContext: toolContext()
    });

    expect(result.status).toBe("completed");
    expect(result.evidenceBundle).toMatchObject({
      schemaVersion: 1,
      unitId: "unit-auth",
      completeness: "complete",
      items: [
        {
          id: "unit-auth-evidence-1",
          checkId: "check-auth",
          source: "file_read",
          arguments: { path: "src/auth.ts" },
          content: "export function authenticate() { return false; }",
          contentHash: expect.stringMatching(/^sha256:/)
        },
        {
          id: "unit-auth-evidence-2",
          checkId: "check-auth",
          source: "code_search",
          arguments: { pattern: "authenticate" },
          content: "src/auth.ts:1:authenticate",
          contentHash: expect.stringMatching(/^sha256:/)
        }
      ]
    });
    expect(result).not.toHaveProperty("findings");
    for (const [input] of vi.mocked(provider.chat).mock.calls) {
      expect(input.tools?.map((tool) => tool.name)).toEqual([
        "file_read",
        "file_find",
        "code_search",
        "file_read_diff"
      ]);
      expect(input.messages).toHaveLength(2);
      expect(input.messages.map((message) => message.role)).toEqual(["system", "user"]);
    }
    const secondUserMessage = vi.mocked(provider.chat).mock.calls[1]![0].messages[1];
    expect(secondUserMessage?.role).toBe("user");
    if (secondUserMessage?.role !== "user") {
      throw new Error("第二轮必须重新构造独立用户消息");
    }
    expect(JSON.parse(secondUserMessage.content)).toMatchObject({
      stage: "react-evidence-collection",
      unit: { unitId: "unit-auth" },
      toolResults: [
        {
          evidenceId: "unit-auth-evidence-1",
          checkId: "check-auth",
          source: "file_read"
        }
      ]
    });
  });

  it("将同一个阶段 signal 传到 provider、executor 和 GitClient 读取", async () => {
    const controller = new AbortController();
    const context = toolContext();
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "signal-provider",
      chat: vi
        .fn()
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            { id: "read-auth", name: "file_read", arguments: { path: "src/auth.ts" } }
          ],
          usage: { inputTokens: 1, outputTokens: 1 }
        })
        .mockResolvedValueOnce({
          content: "结束",
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 1 }
        })
    };

    await runReviewReactStage({
      unit: unit(),
      authorizer: authorizer(),
      provider,
      toolExecutorContext: context,
      signal: controller.signal
    });

    const stageSignal = vi.mocked(provider.chat).mock.calls[0]![0].signal;
    expect(stageSignal).toBeDefined();
    expect(vi.mocked(provider.chat).mock.calls[1]![0].signal).toBe(stageSignal);
    expect(context.gitClient.readFileAtRef).toHaveBeenCalledWith(
      "feature/auth",
      "src/auth.ts",
      stageSignal
    );
  });

  it("后续 provider 消息只发送工具内容摘要，EvidenceBundle 保留完整内容", async () => {
    const longContent = "完整工具内容-".repeat(80);
    const context = toolContext();
    vi.mocked(context.gitClient.readFileAtRef).mockResolvedValue(longContent);
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "summary-provider",
      chat: vi
        .fn()
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            { id: "read-auth", name: "file_read", arguments: { path: "src/auth.ts" } }
          ],
          usage: { inputTokens: 1, outputTokens: 1 }
        })
        .mockResolvedValueOnce({
          content: "完成",
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 1 }
        })
    };

    const result = await runReviewReactStage({
      unit: unit(),
      authorizer: authorizer(),
      provider,
      toolExecutorContext: context
    });

    const secondUser = vi.mocked(provider.chat).mock.calls[1]![0].messages[1];
    if (!secondUser || secondUser.role !== "user") throw new Error("预期第二轮用户消息");
    const toolResult = JSON.parse(secondUser.content).toolResults[0];
    expect(toolResult).not.toHaveProperty("content");
    expect(toolResult.contentSummary.length).toBeLessThan(longContent.length);
    expect(toolResult.contentHash).toMatch(/^sha256:/);
    expect(result.evidenceBundle.items[0]?.content).toBe(longContent);
  });

  it("有检查项但没有证据时不能返回 complete", async () => {
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "empty-evidence-provider",
      chat: vi.fn().mockResolvedValue({
        content: "没有找到证据",
        toolCalls: [],
        usage: { inputTokens: 1, outputTokens: 1 }
      })
    };

    const result = await runReviewReactStage({
      unit: unit(),
      authorizer: authorizer(),
      provider,
      toolExecutorContext: toolContext()
    });

    expect(result.status).toBe("evidence-incomplete");
    expect(result.evidenceBundle.completeness).toBe("incomplete");
    expect(result.stopReason).toMatchObject({
      type: "checks-incomplete",
      missingCheckIds: ["check-auth"]
    });
  });

  it("多检查项按工具调用中的 checkId 选择授权器并覆盖全部检查", async () => {
    const reviewUnit = unit({}, [
      unit().checks[0]!,
      {
        id: "check-session",
        description: "检查会话失效分支",
        completionCriteria: ["确认会话失效被处理"],
        allowedFiles: ["src/auth.ts"],
        evidenceTargets: ["session"]
      }
    ]);
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "multi-check-provider",
      chat: vi
        .fn()
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: "read-auth",
              name: "file_read",
              arguments: { checkId: "check-auth", path: "src/auth.ts" }
            },
            {
              id: "search-session",
              name: "code_search",
              arguments: { checkId: "check-session", pattern: "session" }
            }
          ],
          usage: { inputTokens: 1, outputTokens: 1 }
        })
        .mockResolvedValueOnce({
          content: "完成",
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 1 }
        })
    };

    const result = await runReviewReactStage({
      unit: reviewUnit,
      authorizers: authorizersFor(reviewUnit),
      provider,
      toolExecutorContext: toolContext()
    });

    expect(result.status).toBe("completed");
    expect(result.evidenceBundle.items.map((item) => item.checkId)).toEqual([
      "check-auth",
      "check-session"
    ]);
  });

  it("多检查项只覆盖部分检查时返回缺失检查项并保持 incomplete", async () => {
    const reviewUnit = unit({}, [
      unit().checks[0]!,
      {
        id: "check-session",
        description: "检查会话失效分支",
        completionCriteria: ["确认会话失效被处理"],
        allowedFiles: ["src/auth.ts"],
        evidenceTargets: ["session"]
      }
    ]);
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "partial-check-provider",
      chat: vi
        .fn()
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            {
              id: "read-auth",
              name: "file_read",
              arguments: { checkId: "check-auth", path: "src/auth.ts" }
            }
          ],
          usage: { inputTokens: 1, outputTokens: 1 }
        })
        .mockResolvedValueOnce({
          content: "只完成一个检查项",
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 1 }
        })
        .mockResolvedValueOnce({
          content: "仍未完成",
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 1 }
        })
    };

    const result = await runReviewReactStage({
      unit: reviewUnit,
      authorizers: authorizersFor(reviewUnit),
      provider,
      toolExecutorContext: toolContext()
    });

    expect(result.status).toBe("evidence-incomplete");
    expect(result.evidenceBundle.completeness).toBe("incomplete");
    expect(result.stopReason).toEqual({
      type: "checks-incomplete",
      missingCheckIds: ["check-session"]
    });
    const secondUserMessage = vi.mocked(provider.chat).mock.calls[1]![0].messages[1];
    expect(secondUserMessage?.role).toBe("user");
    if (secondUserMessage?.role !== "user") {
      throw new Error("预期第二轮用户消息");
    }
    expect(JSON.parse(secondUserMessage.content)).toMatchObject({
      missingCheckIds: ["check-session"]
    });
  });

  it("模型提前停止时，仍有调用预算则继续收集缺失检查项", async () => {
    const reviewUnit = unit({ modelCalls: 3 }, [
      unit().checks[0]!,
      {
        id: "check-session",
        description: "检查会话失效分支",
        completionCriteria: ["确认会话失效被处理"],
        allowedFiles: ["src/auth.ts"],
        evidenceTargets: ["session"]
      }
    ]);
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "early-stop-provider",
      chat: vi
        .fn()
        .mockResolvedValueOnce({
          content: "先停一下",
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 1 }
        })
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [{
            id: "read-session",
            name: "code_search",
            arguments: { checkId: "check-session", pattern: "session" }
          }],
          usage: { inputTokens: 1, outputTokens: 1 }
        })
        .mockResolvedValueOnce({
          content: "完成",
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 1 }
        })
    };

    const result = await runReviewReactStage({
      unit: reviewUnit,
      authorizers: authorizersFor(reviewUnit),
      provider,
      toolExecutorContext: toolContext()
    });

    expect(result.status).toBe("evidence-incomplete");
    expect(result.stopReason).toEqual({
      type: "checks-incomplete",
      missingCheckIds: ["check-auth"]
    });
    expect(provider.chat).toHaveBeenCalledTimes(3);
  });

  it("拒绝不属于当前 unit.checks 的 checkId", async () => {
    const reviewUnit = unit();
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "invalid-check-provider",
      chat: vi.fn().mockResolvedValue({
        content: null,
        toolCalls: [
          {
            id: "read-invalid-check",
            name: "file_read",
            arguments: { checkId: "check-other", path: "src/auth.ts" }
          }
        ],
        usage: { inputTokens: 1, outputTokens: 1 }
      })
    };

    const result = await runReviewReactStage({
      unit: reviewUnit,
      authorizers: authorizersFor(reviewUnit),
      provider,
      toolExecutorContext: toolContext()
    });

    expect(result.status).toBe("evidence-incomplete");
    expect(result.stopReason).toMatchObject({
      type: "authorization-denied",
      code: "check-not-authorized"
    });
  });

  it("provider 缺少 usage 时仍执行授权工具并显式标记不可计量", async () => {
    const context = toolContext();
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "usage-unavailable-provider",
      chat: vi
        .fn()
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            { id: "read-auth", name: "file_read", arguments: { path: "src/auth.ts" } }
          ]
        })
        .mockResolvedValueOnce({ content: "结束", toolCalls: [] })
    };

    const result = await runReviewReactStage({
      unit: unit(),
      authorizer: authorizer(),
      provider,
      toolExecutorContext: context
    });

    expect(result.status).toBe("completed");
    expect(result.evidenceBundle.items).toHaveLength(1);
    expect(result.evidenceBundle.completeness).toBe("complete");
    expect(result.usage.usageUnavailable).toBe(true);
    expect(result.usage.inputTokens).toBeUndefined();
    expect(result.usage.outputTokens).toBeUndefined();
    expect(result.stopReason).toEqual({
      type: "usage-unavailable",
      budget: "inputTokens"
    });
    expect(provider.chat).toHaveBeenCalledTimes(2);
    expect(context.gitClient.readFileAtRef).toHaveBeenCalledOnce();
  });

  it("缺少 usage 且缺检查项时保留 checks-incomplete stop reason", async () => {
    const reviewUnit = unit({}, [
      unit().checks[0]!,
      {
        id: "check-session",
        description: "检查会话失效分支",
        completionCriteria: ["确认会话失效被处理"],
        allowedFiles: ["src/auth.ts"],
        evidenceTargets: ["session"]
      }
    ]);
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "usage-unavailable-incomplete-provider",
      chat: vi.fn().mockResolvedValue({ content: "结束", toolCalls: [] })
    };

    const result = await runReviewReactStage({
      unit: reviewUnit,
      authorizers: authorizersFor(reviewUnit),
      provider,
      toolExecutorContext: toolContext()
    });

    expect(result.evidenceBundle.completeness).toBe("incomplete");
    expect(result.stopReason).toEqual({
      type: "checks-incomplete",
      missingCheckIds: ["check-auth", "check-session"]
    });
    expect(result.usage.usageUnavailable).toBe(true);
  });

  it.each([
    {
      label: "code_comment",
      toolCall: {
        id: "comment",
        name: "code_comment",
        arguments: { file: "src/auth.ts", summary: "不应生成评论" }
      } satisfies ToolCall,
      reasonCode: "tool-not-read-only"
    },
    {
      label: "task_done",
      toolCall: {
        id: "done",
        name: "task_done",
        arguments: {}
      } satisfies ToolCall,
      reasonCode: "tool-not-read-only"
    },
    {
      label: "越界文件读取",
      toolCall: {
        id: "read-secret",
        name: "file_read",
        arguments: { path: "src/secret.ts" }
      } satisfies ToolCall,
      reasonCode: "file-not-authorized"
    }
  ])("拒绝 $label 并结构化标记证据不完整", async ({ toolCall, reasonCode }) => {
    const context = toolContext();
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "malicious-provider",
      chat: vi.fn().mockResolvedValue({
        content: null,
        toolCalls: [toolCall],
        usage: { inputTokens: 10, outputTokens: 5 }
      })
    };

    const result = await runReviewReactStage({
      unit: unit(),
      authorizer: authorizer(),
      provider,
      toolExecutorContext: context
    });

    expect(result.status).toBe("evidence-incomplete");
    expect(result.evidenceBundle).toMatchObject({
      items: [],
      completeness: "incomplete"
    });
    expect(result.stopReason).toMatchObject({
      type: "authorization-denied",
      toolCallId: toolCall.id,
      code: reasonCode
    });
    expect(context.gitClient.readFileAtRef).not.toHaveBeenCalled();
    expect(context.gitClient.grep).not.toHaveBeenCalled();
  });

  it("模型调用预算耗尽后停止并保留已收集证据", async () => {
    const reviewUnit = unit({ modelCalls: 1 });
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "model-budget-provider",
      chat: vi.fn().mockResolvedValue({
        content: null,
        toolCalls: [
          { id: "read-auth", name: "file_read", arguments: { path: "src/auth.ts" } }
        ],
        usage: { inputTokens: 1, outputTokens: 1 }
      })
    };

    const result = await runReviewReactStage({
      unit: reviewUnit,
      authorizer: authorizer(reviewUnit),
      provider,
      toolExecutorContext: toolContext()
    });

    expect(result.evidenceBundle.items).toHaveLength(1);
    expect(result.stopReason).toEqual({
      type: "budget-exhausted",
      budget: "modelCalls"
    });
    expect(result.usage.modelCalls).toBe(1);
  });

  it.each([
    {
      label: "工具调用",
      budgetOverrides: { toolCalls: 1 },
      expectedBudget: "toolCalls"
    },
    {
      label: "读取字节",
      budgetOverrides: { maxReadBytes: 1 },
      expectedBudget: "readBytes"
    }
  ] as const)("$label 预算耗尽时停止后续工具", async ({ budgetOverrides, expectedBudget }) => {
    const reviewUnit = unit(budgetOverrides);
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "tool-budget-provider",
      chat: vi.fn().mockResolvedValue({
        content: null,
        toolCalls: [
          { id: "read-auth", name: "file_read", arguments: { path: "src/auth.ts" } },
          { id: "search-auth", name: "code_search", arguments: { pattern: "authenticate" } }
        ],
        usage: { inputTokens: 1, outputTokens: 1 }
      })
    };
    const context = toolContext();

    const result = await runReviewReactStage({
      unit: reviewUnit,
      authorizer: authorizer(reviewUnit),
      provider,
      toolExecutorContext: context
    });

    expect(result.evidenceBundle.items).toHaveLength(1);
    expect(result.stopReason).toEqual({
      type: "budget-exhausted",
      budget: expectedBudget
    });
    expect(context.gitClient.grep).not.toHaveBeenCalled();
  });

  it("recordResult 超出 readBytes 后立即结束，不等待 provider 下一轮", async () => {
    const reviewUnit = unit({ maxReadBytes: 1 });
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "read-byte-regression-provider",
      chat: vi
        .fn()
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [
            { id: "read-auth", name: "file_read", arguments: { path: "src/auth.ts" } }
          ],
          usage: { inputTokens: 1, outputTokens: 1 }
        })
        .mockResolvedValueOnce({
          content: "模型下一轮直接结束",
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 1 }
        })
    };

    const result = await runReviewReactStage({
      unit: reviewUnit,
      authorizer: authorizer(reviewUnit),
      provider,
      toolExecutorContext: toolContext()
    });

    expect(result.status).toBe("evidence-incomplete");
    expect(result.evidenceBundle.completeness).toBe("complete");
    expect(result.stopReason).toEqual({
      type: "budget-exhausted",
      budget: "readBytes"
    });
    expect(provider.chat).toHaveBeenCalledOnce();
  });

  it.each([
    {
      label: "输入 token",
      budgetOverrides: { maxInputTokens: 5 },
      usage: { inputTokens: 6, outputTokens: 0 },
      expectedBudget: "inputTokens"
    },
    {
      label: "输出 token",
      budgetOverrides: { maxOutputTokens: 5 },
      usage: { inputTokens: 0, outputTokens: 6 },
      expectedBudget: "outputTokens"
    }
  ] as const)("$label 预算耗尽时不再执行模型请求的工具", async ({
    budgetOverrides,
    usage,
    expectedBudget
  }) => {
    const reviewUnit = unit(budgetOverrides);
    const context = toolContext();
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "token-budget-provider",
      chat: vi.fn().mockResolvedValue({
        content: null,
        toolCalls: [
          { id: "read-auth", name: "file_read", arguments: { path: "src/auth.ts" } }
        ],
        usage
      })
    };

    const result = await runReviewReactStage({
      unit: reviewUnit,
      authorizer: authorizer(reviewUnit),
      provider,
      toolExecutorContext: context
    });

    expect(result.evidenceBundle.items).toEqual([]);
    expect(result.stopReason).toEqual({
      type: "budget-exhausted",
      budget: expectedBudget
    });
    expect(context.gitClient.readFileAtRef).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "输入 token",
      budgetOverrides: { maxInputTokens: 5 },
      usage: { inputTokens: 6, outputTokens: 0 },
      expectedBudget: "inputTokens"
    },
    {
      label: "输出 token",
      budgetOverrides: { maxOutputTokens: 5 },
      usage: { inputTokens: 0, outputTokens: 6 },
      expectedBudget: "outputTokens"
    }
  ] as const)("终止响应超过 $label 预算时仍标记证据不完整", async ({
    budgetOverrides,
    usage,
    expectedBudget
  }) => {
    const reviewUnit = unit(budgetOverrides);
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "terminal-token-budget-provider",
      chat: vi.fn().mockResolvedValue({ content: "结束", toolCalls: [], usage })
    };

    const result = await runReviewReactStage({
      unit: reviewUnit,
      authorizer: authorizer(reviewUnit),
      provider,
      toolExecutorContext: toolContext()
    });

    expect(result.status).toBe("evidence-incomplete");
    expect(result.stopReason).toEqual({
      type: "budget-exhausted",
      budget: expectedBudget
    });
  });

  it("阶段时长预算耗尽时不再执行模型请求的工具", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValue(1_020);
    const reviewUnit = unit({ maxDurationMs: 10 });
    const context = toolContext();
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "duration-budget-provider",
      chat: vi.fn().mockResolvedValue({
        content: null,
        toolCalls: [
          { id: "read-auth", name: "file_read", arguments: { path: "src/auth.ts" } }
        ],
        usage: { inputTokens: 1, outputTokens: 1 }
      })
    };

    const result = await runReviewReactStage({
      unit: reviewUnit,
      authorizer: authorizer(reviewUnit),
      provider,
      toolExecutorContext: context
    });

    expect(result.evidenceBundle.items).toEqual([]);
    expect(result.stopReason).toEqual({
      type: "budget-exhausted",
      budget: "durationMs"
    });
    expect(context.gitClient.readFileAtRef).not.toHaveBeenCalled();
    now.mockRestore();
  });

  it("开始前已取消时抛出 AbortError，不调用 provider 或伪造 EvidenceBundle", async () => {
    const controller = new AbortController();
    controller.abort();
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "cancelled-provider",
      chat: vi.fn().mockResolvedValue({ content: "不应调用", toolCalls: [] })
    };

    await expect(runReviewReactStage({
      unit: unit(),
      authorizer: authorizer(),
      provider,
      toolExecutorContext: toolContext(),
      signal: controller.signal
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(provider.chat).not.toHaveBeenCalled();
  });

  it("provider 调用进行中取消时立即抛出 AbortError", async () => {
    const controller = new AbortController();
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "pending-provider",
      chat: vi.fn().mockReturnValue(new Promise(() => undefined))
    };
    const stage = runReviewReactStage({
      unit: unit(),
      authorizer: authorizer(),
      provider,
      toolExecutorContext: toolContext(),
      signal: controller.signal
    });

    await vi.waitFor(() => expect(provider.chat).toHaveBeenCalledOnce());
    expect(vi.mocked(provider.chat).mock.calls[0]![0].signal).toBeDefined();
    controller.abort();

    await expect(Promise.race([
      stage,
      new Promise((resolve) => setTimeout(() => resolve("仍在等待 provider"), 50))
    ])).rejects.toMatchObject({ name: "AbortError" });
  });

  it("工具执行进行中取消时立即抛出 AbortError，不生成部分完成包", async () => {
    const controller = new AbortController();
    const context = toolContext();
    vi.mocked(context.gitClient.readFileAtRef).mockReturnValue(
      new Promise(() => undefined)
    );
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "tool-cancellation-provider",
      chat: vi.fn().mockResolvedValue({
        content: null,
        toolCalls: [
          { id: "read-auth", name: "file_read", arguments: { path: "src/auth.ts" } }
        ],
        usage: { inputTokens: 1, outputTokens: 1 }
      })
    };
    const stage = runReviewReactStage({
      unit: unit(),
      authorizer: authorizer(),
      provider,
      toolExecutorContext: context,
      signal: controller.signal
    });

    await vi.waitFor(() => expect(context.gitClient.readFileAtRef).toHaveBeenCalledOnce());
    controller.abort();

    await expect(Promise.race([
      stage,
      new Promise((resolve) => setTimeout(() => resolve("仍在等待工具"), 50))
    ])).rejects.toMatchObject({ name: "AbortError" });
  });

  it("provider 长时间未返回时由阶段时长预算主动终止", async () => {
    const reviewUnit = unit({ maxDurationMs: 10 });
    const provider: Pick<LlmProvider, "id" | "chat"> = {
      id: "duration-timeout-provider",
      chat: vi.fn().mockReturnValue(new Promise(() => undefined))
    };

    const result = await Promise.race([
      runReviewReactStage({
        unit: reviewUnit,
        authorizer: authorizer(reviewUnit),
        provider,
        toolExecutorContext: toolContext()
      }),
      new Promise((resolve) => setTimeout(() => resolve("阶段未主动停止"), 100))
    ]);

    expect(result).toMatchObject({
      status: "evidence-incomplete",
      evidenceBundle: { completeness: "incomplete", items: [] },
      stopReason: { type: "budget-exhausted", budget: "durationMs" }
    });
    expect(vi.mocked(provider.chat).mock.calls[0]![0].signal?.aborted).toBe(true);
  });
});
