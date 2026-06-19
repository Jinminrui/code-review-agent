import { describe, expect, it, vi } from "vitest";
import { executeToolCall } from "../src/infrastructure/llm/tool-executors.js";

describe("executeToolCall file_read_diff", () => {
  it("uses preloaded diff files instead of re-reading git diff", async () => {
    const readDiff = vi.fn().mockRejectedValue(new Error("should not read diff again"));
    const readWorkspaceDiff = vi.fn().mockRejectedValue(new Error("should not read workspace diff again"));

    const result = await executeToolCall(
      {
        id: "tool_1",
        name: "file_read_diff",
        arguments: { path: "src/file.ts" }
      },
      {
        gitClient: {
          readFileAtRef: vi.fn(),
          lsFiles: vi.fn(),
          grep: vi.fn(),
          readDiff,
          readWorkspaceDiff
        },
        baseRef: "HEAD",
        targetRef: "WORKSPACE",
        repositoryPath: "/repo",
        diffFiles: [
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
                lines: [
                  { type: "deleted", content: "export const value = 1;", oldLineNum: 1, newLineNum: null },
                  { type: "added", content: "export const value = 2;", oldLineNum: null, newLineNum: 1 }
                ]
              }
            ]
          }
        ]
      }
    );

    expect(result.isError).toBeUndefined();
    expect(result.content).toContain("--- a/src/file.ts");
    expect(result.content).toContain("-export const value = 1;");
    expect(result.content).toContain("+export const value = 2;");
    expect(readDiff).not.toHaveBeenCalled();
    expect(readWorkspaceDiff).not.toHaveBeenCalled();
  });
});
