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
});
