import { describe, expect, it, vi } from "vitest";
import { streamReviewSession } from "../src/application/stream-review-session.js";

describe("streamReviewSession", () => {
  it("emits started and finished events", async () => {
    const provider = {
      id: "mock",
      review: vi.fn().mockResolvedValue({
        content: JSON.stringify({ findings: [] })
      })
    };

    const events: string[] = [];

    for await (const event of streamReviewSession({
      input: {
        repositoryPath: "/tmp/repo",
        baseRef: "main",
        targetRef: "feature",
        providerProfileId: "mock",
        contextBudgetTokens: 12000
      },
      dependencies: {
        provider,
        gitClient: {
          readDiff: vi.fn().mockResolvedValue([{ path: "src/a.ts", hunks: [] }]),
          readFileAtRef: vi.fn().mockResolvedValue("export const a = 1;\n")
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
