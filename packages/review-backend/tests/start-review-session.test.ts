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
