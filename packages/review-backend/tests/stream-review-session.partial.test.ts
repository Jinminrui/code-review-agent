import { describe, expect, it, vi } from "vitest";
import { streamReviewSession } from "../src/application/stream-review-session.js";

describe("streamReviewSession partial mode", () => {
  it("keeps later units running when one unit fails", async () => {
    const provider = {
      id: "mock",
      review: vi
        .fn()
        .mockRejectedValueOnce(new Error("provider timeout"))
        .mockResolvedValueOnce({ content: JSON.stringify({ findings: [] }) })
    };

    const events: Array<{ type: string }> = [];

    for await (const event of streamReviewSession({
      input: {
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "feature",
        providerProfileId: "default",
        contextBudgetTokens: 12000
      },
      dependencies: {
        provider,
        gitClient: {
          readDiff: vi.fn().mockResolvedValue([
            { path: "src/a.ts", hunks: [] },
            { path: "src/b.ts", hunks: [] }
          ]),
          readFileAtRef: vi.fn().mockResolvedValue("export const value = 1;\n")
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

    expect(events.map((event) => event.type)).toEqual([
      "session-started",
      "unit-failed",
      "unit-completed",
      "session-finished"
    ]);
  });
});
