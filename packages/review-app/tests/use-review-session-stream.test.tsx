/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReviewSessionStream } from "../src/hooks/use-review-session-stream";
import { useReviewSessionStore } from "../src/store/review-session-store";
import type { ReviewSessionEvent } from "../src/lib/review-model";

describe("useReviewSessionStream", () => {
  it("subscribes to a session and unsubscribes on cleanup", async () => {
    const unsubscribe = vi.fn();
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn(),
      selectRepository: vi.fn(),
      listBranches: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn().mockResolvedValue({
        sessionId: "s_1",
        status: "running",
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "feature",
        summary: { changedFilesCount: 0, findingsCount: 0, highSeverityCount: 0, files: [] },
        findings: []
      }),
      listSessions: vi.fn(),
      deleteSession: vi.fn(),
      cancelSession: vi.fn(),
      exportSession: vi.fn(),
      subscribeSession: vi.fn().mockReturnValue(unsubscribe)
    };

    const { unmount } = renderHook(() => useReviewSessionStream("s_1"));

    await waitFor(() => {
      expect(window.reviewWorkbenchApi.subscribeSession).toHaveBeenCalledWith("s_1", expect.any(Function));
    });

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("handles session-cancelled event and refreshes session", async () => {
    let eventHandler: ((event: ReviewSessionEvent) => void) | undefined;
    const unsubscribe = vi.fn();

    const cancelledSession = {
      sessionId: "s_1",
      status: "cancelled" as const,
      createdAt: "2026-06-19T00:00:00.000Z",
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature",
      summary: { changedFilesCount: 1, findingsCount: 0, highSeverityCount: 0, files: ["src/a.ts"] },
      diffByFile: {},
      findings: []
    };

    window.reviewWorkbenchApi = {
      listRepositories: vi.fn(),
      selectRepository: vi.fn(),
      listBranches: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn()
        .mockResolvedValueOnce({
          sessionId: "s_1",
          status: "running",
          repositoryPath: "/repo",
          baseRef: "main",
          targetRef: "feature",
          summary: { changedFilesCount: 1, findingsCount: 0, highSeverityCount: 0, files: ["src/a.ts"] },
          diffByFile: {},
          findings: []
        })
        .mockResolvedValueOnce(cancelledSession),
      listSessions: vi.fn(),
      deleteSession: vi.fn(),
      cancelSession: vi.fn(),
      exportSession: vi.fn(),
      subscribeSession: vi.fn().mockImplementation((_sessionId: string, handler: (event: ReviewSessionEvent) => void) => {
        eventHandler = handler;
        return unsubscribe;
      })
    };

    renderHook(() => useReviewSessionStream("s_1"));

    await waitFor(() => {
      expect(window.reviewWorkbenchApi.subscribeSession).toHaveBeenCalled();
    });

    // Simulate session-cancelled event
    if (eventHandler) {
      eventHandler({ type: "session-cancelled", sessionId: "s_1", totalFindings: 0 });
    }

    await waitFor(() => {
      expect(window.reviewWorkbenchApi.getSession).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      const store = useReviewSessionStore.getState();
      expect(store.session?.status).toBe("cancelled");
    });
  });

  it("merges diff content from unit-completed events so streamed findings can show diff", async () => {
    let eventHandler: ((event: ReviewSessionEvent) => void) | undefined;

    window.reviewWorkbenchApi = {
      listRepositories: vi.fn(),
      selectRepository: vi.fn(),
      listBranches: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn().mockResolvedValue({
        sessionId: "s_1",
        status: "running",
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "feature",
        summary: {
          changedFilesCount: 1,
          findingsCount: 0,
          highSeverityCount: 0,
          files: ["src/file.ts"]
        },
        findings: [],
        diffByFile: {}
      }),
      listSessions: vi.fn(),
      deleteSession: vi.fn(),
      cancelSession: vi.fn(),
      exportSession: vi.fn(),
      subscribeSession: vi.fn().mockImplementation((_sessionId: string, handler: (event: ReviewSessionEvent) => void) => {
        eventHandler = handler;
        return vi.fn();
      })
    };

    renderHook(() => useReviewSessionStream("s_1"));

    await waitFor(() => {
      expect(useReviewSessionStore.getState().session?.sessionId).toBe("s_1");
    });

    eventHandler?.({
      type: "unit-completed",
      sessionId: "s_1",
      unitId: "unit:src/file.ts",
      findingsCount: 1,
      findings: [
        {
          id: "f_1",
          severity: "high",
          category: "bug",
          summary: "测试问题",
          explanation: "测试说明",
          file: "src/file.ts",
          startLine: 1,
          endLine: 1,
          confidenceSignals: [],
          status: "line-level"
        }
      ],
      diffByFile: {
        "src/file.ts": {
          original: "before\n",
          modified: "after\n"
        }
      }
    });

    expect(useReviewSessionStore.getState().session?.findings).toHaveLength(1);
    expect(useReviewSessionStore.getState().session?.diffByFile["src/file.ts"]?.modified).toBe("after\n");
  });

  it("returns structured progress for runtime phase events", async () => {
    let eventHandler: ((event: ReviewSessionEvent) => void) | undefined;
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn(), selectRepository: vi.fn(), listBranches: vi.fn(), createSession: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ sessionId: "s_1", status: "running", repositoryPath: "/repo", baseRef: "main", targetRef: "feature", summary: { changedFilesCount: 0, findingsCount: 0, highSeverityCount: 0, files: [] }, findings: [], diffByFile: {} }),
      listSessions: vi.fn(), deleteSession: vi.fn(), cancelSession: vi.fn(), exportSession: vi.fn(),
      subscribeSession: vi.fn().mockImplementation((_id, handler) => { eventHandler = handler; return vi.fn(); })
    };
    const { result } = renderHook(() => useReviewSessionStream("s_1"));
    await waitFor(() => expect(eventHandler).toBeDefined());
    eventHandler?.({ type: "phase-transitioned", sessionId: "s_1", schemaVersion: 1, runtimeVersion: "hybrid-1", previousPhase: "session-created", phase: "pre-analysis-completed" });
    expect(result.current.progress.phase).toBe("pre-analysis");
  });
});
