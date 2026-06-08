import { describe, expect, it, vi } from "vitest";
import { createReviewWorkbenchHandlers } from "../src/ipc/review-workbench-handlers.js";

describe("createReviewWorkbenchHandlers", () => {
  it("creates session and forwards follow-up reads", async () => {
    const backend = {
      listRepositories: vi.fn().mockResolvedValue(["/repo"]),
      listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
      getSession: vi.fn().mockResolvedValue({ sessionId: "s_1", status: "running" }),
      listSessions: vi.fn().mockResolvedValue([]),
      deleteSession: vi.fn().mockResolvedValue(undefined),
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

  it("delegates deleteSession to backend", async () => {
    const backend = {
      listRepositories: vi.fn(),
      listBranches: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn(),
      listSessions: vi.fn(),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      exportSessionToMarkdown: vi.fn()
    };

    const handlers = createReviewWorkbenchHandlers({ backend });

    await handlers.deleteSession("session-123");

    expect(backend.deleteSession).toHaveBeenCalledWith("session-123");
  });

  it("delegates exportSession to backend", async () => {
    const backend = {
      listRepositories: vi.fn(),
      listBranches: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn(),
      listSessions: vi.fn(),
      deleteSession: vi.fn(),
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
