import { describe, expect, it, vi } from "vitest";
import { streamReviewSession } from "../src/application/stream-review-session.js";
import type { ReviewSessionEvent } from "../src/domain/review-session.js";

type UnitCompletedEvent = Extract<ReviewSessionEvent, { type: "unit-completed" }>;

describe("streamReviewSession WORKSPACE mode", () => {
  it("uses readWorkspaceDiff when targetRef is WORKSPACE", async () => {
    const readWorkspaceDiff = vi.fn().mockResolvedValue([
      { path: "src/file.ts", isNew: false, isDeleted: false, isBinary: false, insertions: 0, deletions: 0, hunks: [] }
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
          readWorkspaceDiff,
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
      { path: "src/file.ts", isNew: false, isDeleted: false, isBinary: false, insertions: 0, deletions: 0, hunks: [] }
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
          readWorkspaceDiff,
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

  it("emits diff content with unit-completed events", async () => {
    const readWorkspaceDiff = vi.fn().mockResolvedValue([
      {
        path: "src/file.ts",
        isNew: false,
        isDeleted: false,
        isBinary: false,
        insertions: 1,
        deletions: 1,
        hunks: [
          {
            oldStart: 1,
            oldCount: 1,
            newStart: 1,
            newCount: 1,
            lines: [{ type: "added", content: "export const value = 2;" }]
          }
        ]
      }
    ]);

    const provider = {
      id: "mock",
      review: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          findings: [
            {
              severity: "high",
              category: "bug",
              summary: "测试问题",
              explanation: "测试说明",
              file: "src/file.ts",
              startLine: 1,
              endLine: 1,
              confidenceSignals: []
            }
          ]
        })
      })
    };

    const unitCompletedEvents: UnitCompletedEvent[] = [];

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
          readDiff: vi.fn(),
          readWorkspaceDiff,
          readFileAtRef: vi
            .fn()
            .mockResolvedValueOnce("export const value = 1;\n")
            .mockResolvedValueOnce("export const value = 2;\n"),
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
      if (event.type === "unit-completed") {
        unitCompletedEvents.push(event);
      }
    }

    expect(unitCompletedEvents).toHaveLength(1);
    expect(unitCompletedEvents[0]?.diffByFile).toEqual({
      "src/file.ts": {
        original: "export const value = 1;\n",
        modified: "export const value = 2;\n"
      }
    });
  });

  it("normalizes streamed finding file paths to match diff keys", async () => {
    const readWorkspaceDiff = vi.fn().mockResolvedValue([
      {
        path: "src/file.ts",
        isNew: false,
        isDeleted: false,
        isBinary: false,
        insertions: 1,
        deletions: 0,
        hunks: [
          {
            oldStart: 1,
            oldCount: 1,
            newStart: 1,
            newCount: 1,
            lines: [{ type: "added", content: "export const value = 2;" }]
          }
        ]
      }
    ]);

    const provider = {
      id: "mock",
      review: vi.fn(),
      chat: vi.fn().mockResolvedValueOnce({
        content: null,
        toolCalls: [
          {
            id: "call_1",
            name: "code_comment",
            arguments: {
              file: "./src/file.ts",
              start_line: 1,
              end_line: 1,
              severity: "high",
              category: "bug",
              summary: "测试问题",
              explanation: "测试说明"
            }
          },
          {
            id: "call_2",
            name: "task_done",
            arguments: {}
          }
        ]
      })
    };

    const completed: UnitCompletedEvent[] = [];

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
          readDiff: vi.fn(),
          readWorkspaceDiff,
          readFileAtRef: vi
            .fn()
            .mockResolvedValueOnce("export const value = 1;\n")
            .mockResolvedValueOnce("export const value = 2;\n"),
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
      if (event.type === "unit-completed") {
        completed.push(event);
      }
    }

    const event = completed[0];
    expect(event).toBeDefined();
    if (!event) {
      throw new Error("expected unit-completed event");
    }
    const finding = event.findings[0];
    expect(finding?.file).toBe("src/file.ts");
    expect(event.diffByFile[finding!.file]?.modified).toContain("value = 2");
  });
});
