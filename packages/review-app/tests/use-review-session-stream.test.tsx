import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReviewSessionStream } from "../src/hooks/use-review-session-stream";

describe("useReviewSessionStream", () => {
  it("subscribes to a session and unsubscribes on cleanup", async () => {
    const unsubscribe = vi.fn();
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn(),
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
      subscribeSession: vi.fn().mockReturnValue(unsubscribe)
    };

    const { unmount } = renderHook(() => useReviewSessionStream("s_1"));

    await waitFor(() => {
      expect(window.reviewWorkbenchApi.subscribeSession).toHaveBeenCalledWith("s_1", expect.any(Function));
    });

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
