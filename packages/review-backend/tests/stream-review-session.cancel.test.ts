import { describe, expect, it, vi } from "vitest";
import { streamReviewSession } from "../src/application/stream-review-session.js";

describe("streamReviewSession cancellation", () => {
  it("cancels after the current unit and persists submitted findings", async () => {
    const controller = new AbortController();
    const provider = {
      id: "mock",
      chat: vi.fn().mockResolvedValue({
        content: null,
        toolCalls: [
          {
            id: "call_1",
            name: "code_comment",
            arguments: {
              file: "src/a.ts",
              start_line: 2,
              end_line: 2,
              severity: "high",
              category: "bug",
              summary: "缺少空值保护",
              explanation: "调用 trim 前没有确认 value 存在。",
              evidence: "value.trim()",
              suggestion: "先判断 value 是否为空。"
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
    const sessionStore = {
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
      appendEvent: vi.fn().mockImplementation(async (_sessionId: string, event: { type: string }) => {
        if (event.type === "unit-completed") {
          controller.abort();
        }
      }),
      completeSession: vi.fn().mockResolvedValue(undefined)
    };
    const events: Array<{ type: string }> = [];

    for await (const event of streamReviewSession({
      input: {
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "feature",
        contextBudgetTokens: 12000
      },
      signal: controller.signal,
      dependencies: {
        provider,
        gitClient: {
          readDiff: vi.fn().mockResolvedValue([
            {
              path: "src/a.ts",
              isNew: false,
              isDeleted: false,
              isBinary: false,
              insertions: 1,
              deletions: 0,
              hunks: [
                {
                  oldStart: 1,
                  oldLines: 1,
                  newStart: 1,
                  newLines: 2,
                  lines: [
                    { type: "context", oldLine: 1, newLine: 1, content: "export function normalize(value?: string) {" },
                    { type: "added", newLine: 2, content: "  return value.trim();" }
                  ]
                }
              ]
            },
            {
              path: "src/b.ts",
              isNew: false,
              isDeleted: false,
              isBinary: false,
              insertions: 1,
              deletions: 0,
              hunks: [
                {
                  oldStart: 1,
                  oldLines: 1,
                  newStart: 1,
                  newLines: 2,
                  lines: [
                    { type: "context", oldLine: 1, newLine: 1, content: "export const count = 1;" },
                    { type: "added", newLine: 2, content: "export const next = count + 1;" }
                  ]
                }
              ]
            }
          ]),
          readFileAtRef: vi.fn().mockResolvedValue("export const value = 1;\n"),
          readWorkspaceDiff: vi.fn().mockResolvedValue([]),
          lsFiles: vi.fn().mockResolvedValue([]),
          grep: vi.fn().mockResolvedValue([])
        },
        sessionStore
      }
    })) {
      events.push({ type: event.type });
    }

    expect(events.map((event) => event.type)).toEqual([
      "session-started",
      "unit-completed",
      "session-cancelled"
    ]);
    expect(provider.chat).toHaveBeenCalledTimes(1);
    expect(sessionStore.completeSession).toHaveBeenCalledWith(
      "s_1",
      expect.objectContaining({
        sessionId: "s_1",
        status: "cancelled",
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "feature",
        summary: {
          changedFilesCount: 2,
          findingsCount: 1,
          highSeverityCount: 1,
          files: ["src/a.ts", "src/b.ts"]
        },
        findings: [
          expect.objectContaining({
            severity: "high",
            category: "bug",
            summary: "缺少空值保护",
            explanation: "调用 trim 前没有确认 value 存在。",
            file: "src/a.ts",
            startLine: 2,
            endLine: 2,
            evidence: "value.trim()",
            suggestion: "先判断 value 是否为空。",
            confidenceSignals: [],
            status: "line-level"
          })
        ],
        diffByFile: {
          "src/a.ts": {
            original: "export const value = 1;\n",
            modified: "export const value = 1;\n"
          }
        }
      })
    );
    expect(sessionStore.appendEvent).toHaveBeenCalledWith(
      "s_1",
      expect.objectContaining({
        type: "session-cancelled",
        totalFindings: 1
      })
    );
    expect(sessionStore.appendEvent).toHaveBeenCalledWith(
      "s_1",
      expect.objectContaining({
        type: "unit-completed",
        findings: [
          expect.objectContaining({
            summary: "缺少空值保护",
            file: "src/a.ts",
            status: "line-level"
          })
        ]
      })
    );
  });

  it("keeps finished as the terminal event when abort happens after finished append starts", async () => {
    const controller = new AbortController();
    const provider = {
      id: "mock",
      chat: vi.fn().mockResolvedValue({
        content: JSON.stringify({ findings: [] }),
        toolCalls: []
      })
    };
    const sessionStore = {
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
      appendEvent: vi.fn().mockImplementation(async (_sessionId: string, event: { type: string }) => {
        if (event.type === "session-finished") {
          controller.abort();
        }
      }),
      completeSession: vi.fn().mockResolvedValue(undefined)
    };
    const events: Array<{ type: string }> = [];

    for await (const event of streamReviewSession({
      input: {
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "feature",
        contextBudgetTokens: 12000
      },
      signal: controller.signal,
      dependencies: {
        provider,
        gitClient: {
          readDiff: vi.fn().mockResolvedValue([
            {
              path: "src/a.ts",
              isNew: false,
              isDeleted: false,
              isBinary: false,
              insertions: 1,
              deletions: 0,
              hunks: [
                {
                  oldStart: 1,
                  oldLines: 1,
                  newStart: 1,
                  newLines: 2,
                  lines: [
                    { type: "context", oldLine: 1, newLine: 1, content: "export const count = 1;" },
                    { type: "added", newLine: 2, content: "export const next = count + 1;" }
                  ]
                }
              ]
            }
          ]),
          readFileAtRef: vi.fn().mockResolvedValue("export const count = 1;\n"),
          readWorkspaceDiff: vi.fn().mockResolvedValue([]),
          lsFiles: vi.fn().mockResolvedValue([]),
          grep: vi.fn().mockResolvedValue([])
        },
        sessionStore
      }
    })) {
      events.push({ type: event.type });
    }

    expect(events.map((event) => event.type)).toEqual([
      "session-started",
      "unit-completed",
      "session-finished"
    ]);
    expect(sessionStore.completeSession).toHaveBeenCalledTimes(1);
    expect(sessionStore.completeSession).toHaveBeenCalledWith(
      "s_1",
      expect.objectContaining({
        status: "finished",
        summary: {
          changedFilesCount: 1,
          findingsCount: 0,
          highSeverityCount: 0,
          files: ["src/a.ts"]
        }
      })
    );
    expect(sessionStore.appendEvent).not.toHaveBeenCalledWith(
      "s_1",
      expect.objectContaining({ type: "session-cancelled" })
    );
  });
});
