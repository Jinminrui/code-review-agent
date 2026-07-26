/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { describe, expect, it, vi } from "vitest";
import { createReviewWorkbenchHandlers } from "../src/ipc/review-workbench-handlers.js";

describe("createReviewWorkbenchHandlers", () => {
  it("creates session and forwards follow-up reads", async () => {
    const backend = {
      listRepositories: vi.fn().mockResolvedValue(["/repo"]),
      selectRepository: vi.fn(),
      listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
      getSession: vi.fn().mockResolvedValue({ sessionId: "s_1", status: "running" }),
      listSessions: vi.fn().mockResolvedValue([]),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      cancelSession: vi.fn().mockResolvedValue(undefined),
      exportSessionToMarkdown: vi.fn()
    };

    const handlers = createReviewWorkbenchHandlers({ backend });

    await expect(handlers.listRepositories()).resolves.toEqual(["/repo"]);
    await expect(
      handlers.createSession({
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "feature",
        contextBudgetTokens: 12000
      })
    ).resolves.toEqual({ sessionId: "s_1" });
    await expect(handlers.getSession("s_1")).resolves.toMatchObject({ sessionId: "s_1" });
  });

  it("delegates selectRepository to backend", async () => {
    const backend = {
      listRepositories: vi.fn(),
      selectRepository: vi.fn().mockResolvedValue("/Users/test/repo"),
      listBranches: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn(),
      listSessions: vi.fn(),
      deleteSession: vi.fn(),
      cancelSession: vi.fn(),
      exportSessionToMarkdown: vi.fn()
    };

    const handlers = createReviewWorkbenchHandlers({ backend });

    await expect(handlers.selectRepository()).resolves.toBe("/Users/test/repo");
    expect(backend.selectRepository).toHaveBeenCalledTimes(1);
  });

  it("delegates deleteSession to backend", async () => {
    const backend = {
      listRepositories: vi.fn(),
      selectRepository: vi.fn(),
      listBranches: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn(),
      listSessions: vi.fn(),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      cancelSession: vi.fn(),
      exportSessionToMarkdown: vi.fn()
    };

    const handlers = createReviewWorkbenchHandlers({ backend });

    await handlers.deleteSession("session-123");

    expect(backend.deleteSession).toHaveBeenCalledWith("session-123");
  });

  it("delegates cancelSession to backend", async () => {
    const backend = {
      listRepositories: vi.fn(),
      selectRepository: vi.fn(),
      listBranches: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn(),
      listSessions: vi.fn(),
      deleteSession: vi.fn(),
      cancelSession: vi.fn().mockResolvedValue(undefined),
      exportSessionToMarkdown: vi.fn()
    };

    const handlers = createReviewWorkbenchHandlers({ backend });

    await handlers.cancelSession("session-123");

    expect(backend.cancelSession).toHaveBeenCalledWith("session-123");
  });

  it("cancelSession is idempotent for non-existent sessionId", async () => {
    const backend = {
      listRepositories: vi.fn(),
      selectRepository: vi.fn(),
      listBranches: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn(),
      listSessions: vi.fn(),
      deleteSession: vi.fn(),
      cancelSession: vi.fn().mockResolvedValue(undefined),
      exportSessionToMarkdown: vi.fn()
    };

    const handlers = createReviewWorkbenchHandlers({ backend });

    // 对不存在的 sessionId 调用 cancelSession 应该幂等成功（不抛异常）
    await expect(handlers.cancelSession("non-existent-session")).resolves.toBeUndefined();
    expect(backend.cancelSession).toHaveBeenCalledWith("non-existent-session");

    // 连续调用也应幂等成功
    await expect(handlers.cancelSession("non-existent-session")).resolves.toBeUndefined();
    expect(backend.cancelSession).toHaveBeenCalledTimes(2);
  });

  it("delegates exportSession to backend", async () => {
    const backend = {
      listRepositories: vi.fn(),
      selectRepository: vi.fn(),
      listBranches: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn(),
      listSessions: vi.fn(),
      deleteSession: vi.fn(),
      cancelSession: vi.fn(),
      exportSessionToMarkdown: vi.fn().mockResolvedValue("# Report")
    };

    const handlers = createReviewWorkbenchHandlers({ backend });

    const result = await handlers.exportSession("session-123");

    expect(backend.exportSessionToMarkdown).toHaveBeenCalledWith("session-123");
    expect(result).toEqual({
      markdown: "# Report",
      filename: "review-session-123.md"
    });
  });
});
