import { describe, expect, it, vi } from "vitest";
import { streamReviewSession } from "../src/application/stream-review-session.js";

describe("streamReviewSession WORKSPACE mode", () => {
  it("uses readWorkspaceDiff when targetRef is WORKSPACE", async () => {
    const readWorkspaceDiff = vi.fn().mockResolvedValue([
      { path: "src/file.ts", hunks: [] }
    ]);
    const readDiff = vi.fn();

    const provider = {
      id: "mock",
      review: vi.fn().mockResolvedValue({ content: JSON.stringify({ findings: [] }) })
    };

    const events: Array<{ type: string }> = [];

    for await (const event of streamReviewSession({
      input: {
        repositoryPath: "/repo",
        baseRef: "HEAD",
        targetRef: "WORKSPACE",
        contextBudgetTokens: 12000
      },
      dependencies: {
        provider,
        gitClient: {
          readDiff,
          readFileAtRef: vi.fn().mockResolvedValue("export const value = 1;\n"),
          readWorkspaceDiff
        },
        sessionStore: {
          createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
          appendEvent: vi.fn().mockResolvedValue(undefined),
          completeSession: vi.fn().mockResolvedValue(undefined)
        }
      }
    })) {
      events.push({ type: event.type });
    }

    expect(readWorkspaceDiff).toHaveBeenCalledOnce();
    expect(readDiff).not.toHaveBeenCalled();
    expect(events.map((event) => event.type)).toEqual([
      "session-started",
      "unit-completed",
      "session-finished"
    ]);
  });

  it("uses readDiff when targetRef is not WORKSPACE", async () => {
    const readWorkspaceDiff = vi.fn();
    const readDiff = vi.fn().mockResolvedValue([
      { path: "src/file.ts", hunks: [] }
    ]);

    const provider = {
      id: "mock",
      review: vi.fn().mockResolvedValue({ content: JSON.stringify({ findings: [] }) })
    };

    const events: Array<{ type: string }> = [];

    for await (const event of streamReviewSession({
      input: {
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "feature",
        contextBudgetTokens: 12000
      },
      dependencies: {
        provider,
        gitClient: {
          readDiff,
          readFileAtRef: vi.fn().mockResolvedValue("export const value = 1;\n"),
          readWorkspaceDiff
        },
        sessionStore: {
          createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
          appendEvent: vi.fn().mockResolvedValue(undefined),
          completeSession: vi.fn().mockResolvedValue(undefined)
        }
      }
    })) {
      events.push({ type: event.type });
    }

    expect(readDiff).toHaveBeenCalledWith("main", "feature");
    expect(readWorkspaceDiff).not.toHaveBeenCalled();
    expect(events.map((event) => event.type)).toEqual([
      "session-started",
      "unit-completed",
      "session-finished"
    ]);
  });
});
