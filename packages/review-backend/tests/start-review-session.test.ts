/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { describe, expect, it, vi } from "vitest";
import { streamReviewSession } from "../src/application/stream-review-session.js";

describe("streamReviewSession", () => {
  it("emits started and finished events", async () => {
    const provider = {
      id: "mock",
      chat: vi.fn().mockResolvedValue({
        content: JSON.stringify({ findings: [] }),
        toolCalls: []
      })
    };

    const events: string[] = [];

    for await (const event of streamReviewSession({
      input: {
        repositoryPath: "/tmp/repo",
        baseRef: "main",
        targetRef: "feature",
        contextBudgetTokens: 12000
      },
      dependencies: {
        provider,
        gitClient: {
          readDiff: vi.fn().mockResolvedValue([
            { path: "src/a.ts", isNew: false, isDeleted: false, isBinary: false, insertions: 0, deletions: 0, hunks: [] }
          ]),
          readFileAtRef: vi.fn().mockResolvedValue("export const a = 1;\n"),
          readWorkspaceDiff: vi.fn().mockResolvedValue([]),
          lsFiles: vi.fn().mockResolvedValue([]),
          grep: vi.fn().mockResolvedValue([])
        },
        sessionStore: {
          createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
          appendEvent: vi.fn().mockResolvedValue(undefined),
          completeSession: vi.fn().mockResolvedValue(undefined)
        }
      }
    })) {
      events.push(event.type);
    }

    expect(events).toEqual(["session-started", "unit-completed", "session-finished"]);
  });
});
