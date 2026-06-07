import type { ToolCall, ToolResult, ToolName } from "../../domain/tool.js";
import type { GitClient } from "../git/git-client.js";
import { logger } from "../logging/logger.js";

export type ToolExecutorContext = {
  gitClient: Pick<GitClient, "readFileAtRef" | "lsFiles" | "grep" | "readDiff">;
  baseRef: string;
  targetRef: string;
  repositoryPath: string;
};

export type ToolExecutor = (
  args: Record<string, unknown>,
  context: ToolExecutorContext
) => Promise<ToolResult>;

const log = logger.child({ component: "tool" });

const fileReadExecutor: ToolExecutor = async (args, context) => {
  const path = args.path as string;
  if (!path) return { toolCallId: "", content: "Error: 'path' parameter is required", isError: true };

  try {
    const ref = context.targetRef === "WORKSPACE" ? "HEAD" : context.targetRef;
    let content = await context.gitClient.readFileAtRef(ref, path);

    const startLine = args.start_line as number | undefined;
    const endLine = args.end_line as number | undefined;
    if (startLine !== undefined || endLine !== undefined) {
      const lines = content.split("\n");
      const start = Math.max(0, (startLine ?? 1) - 1);
      const end = Math.min(lines.length, endLine ?? lines.length);
      content = lines.slice(start, end).join("\n");
    }

    const contentLines = content.split("\n");
    if (contentLines.length > 500) {
      content = contentLines.slice(0, 500).join("\n") + "\n... (truncated at 500 lines)";
    }

    log.debug(`读取文件: ${path}`);
    return { toolCallId: "", content };
  } catch (error) {
    log.warn(`读取文件失败: ${path}`);
    return { toolCallId: "", content: `Error reading file: ${error instanceof Error ? error.message : "unknown error"}`, isError: true };
  }
};

const fileFindExecutor: ToolExecutor = async (args, context) => {
  const keyword = args.keyword as string;
  if (!keyword) return { toolCallId: "", content: "Error: 'keyword' parameter is required", isError: true };

  try {
    const files = await context.gitClient.lsFiles(`*${keyword}*`);
    log.debug(`搜索文件: ${keyword} -> ${files.length} 个匹配`);
    return { toolCallId: "", content: files.length > 0 ? files.join("\n") : "No files found matching the keyword." };
  } catch (error) {
    log.warn(`搜索文件失败: ${keyword}`);
    return { toolCallId: "", content: `Error searching files: ${error instanceof Error ? error.message : "unknown error"}`, isError: true };
  }
};

const codeSearchExecutor: ToolExecutor = async (args, context) => {
  const pattern = args.pattern as string;
  if (!pattern) return { toolCallId: "", content: "Error: 'pattern' parameter is required", isError: true };

  try {
    const regex = args.regex as boolean | undefined;
    const results = await context.gitClient.grep(pattern, { regex });
    log.debug(`代码搜索: ${pattern} -> ${results.length} 个匹配`);
    if (results.length === 0) return { toolCallId: "", content: "No matches found." };
    const capped = results.slice(0, 100);
    const extra = results.length > 100 ? `\n... (${results.length - 100} more matches truncated)` : "";
    return { toolCallId: "", content: capped.join("\n") + extra };
  } catch (error) {
    log.warn(`代码搜索失败: ${pattern}`);
    return { toolCallId: "", content: `Error searching code: ${error instanceof Error ? error.message : "unknown error"}`, isError: true };
  }
};

const codeCommentExecutor: ToolExecutor = async (args) => {
  log.debug(`收到评论: ${args.file} - ${args.summary}`);
  return { toolCallId: "", content: JSON.stringify(args) };
};

const fileReadDiffExecutor: ToolExecutor = async (args, context) => {
  const path = args.path as string | undefined;

  try {
    const diffFiles = await context.gitClient.readDiff(context.baseRef, context.targetRef);

    if (path) {
      const file = diffFiles.find((f) => f.path === path);
      if (!file) return { toolCallId: "", content: `No diff found for file: ${path}` };
      const diffText = file.hunks
        .map((h) => {
          const lines = h.lines.map((l) => {
            const prefix = l.type === "added" ? "+" : l.type === "deleted" ? "-" : " ";
            return prefix + l.content;
          });
          return `@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@\n${lines.join("\n")}`;
        })
        .join("\n");
      log.debug(`读取 diff: ${path}`);
      return { toolCallId: "", content: `--- a/${file.path}\n+++ b/${file.path}\n${diffText}` };
    }

    const summary = diffFiles.map((f) => `${f.path} (+${f.insertions}, -${f.deletions})`).join("\n");
    log.debug(`读取 diff 摘要: ${diffFiles.length} 个文件`);
    return { toolCallId: "", content: summary || "No changes found." };
  } catch (error) {
    log.warn(`读取 diff 失败`);
    return { toolCallId: "", content: `Error reading diff: ${error instanceof Error ? error.message : "unknown error"}`, isError: true };
  }
};

const taskDoneExecutor: ToolExecutor = async () => {
  return { toolCallId: "", content: "Review task completed." };
};

const executors: Record<ToolName, ToolExecutor> = {
  file_read: fileReadExecutor,
  file_find: fileFindExecutor,
  code_search: codeSearchExecutor,
  code_comment: codeCommentExecutor,
  file_read_diff: fileReadDiffExecutor,
  task_done: taskDoneExecutor
};

export function executeToolCall(
  toolCall: ToolCall,
  context: ToolExecutorContext
): Promise<ToolResult> {
  const executor = executors[toolCall.name];
  if (!executor) {
    return Promise.resolve({ toolCallId: toolCall.id, content: `Unknown tool: ${toolCall.name}`, isError: true });
  }
  return executor(toolCall.arguments, context).then((result) => ({ ...result, toolCallId: toolCall.id }));
}

export const REVIEW_TOOL_DEFINITIONS = [
  {
    name: "file_read" as const,
    description: "Read the content of a file at a specific path. Optionally specify start_line and end_line to read a range. Content is capped at 500 lines.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "The file path relative to the repository root" },
        start_line: { type: "number", description: "Optional start line number (1-based)" },
        end_line: { type: "number", description: "Optional end line number (1-based, inclusive)" }
      },
      required: ["path"]
    }
  },
  {
    name: "file_find" as const,
    description: "Search for files by name keyword in the repository.",
    parameters: { type: "object", properties: { keyword: { type: "string", description: "The keyword to search for in file names" } }, required: ["keyword"] }
  },
  {
    name: "code_search" as const,
    description: "Search for text or regex patterns across the repository. Returns file:line:content matches. Limited to 100 results.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "The search pattern" },
        regex: { type: "boolean", description: "Whether to use regex mode (default: false, uses literal text match)" }
      },
      required: ["pattern"]
    }
  },
  {
    name: "code_comment" as const,
    description: "Submit a review comment/findings. Provide the file path, line range, severity, summary, and explanation.",
    parameters: {
      type: "object",
      properties: {
        file: { type: "string", description: "The file path" },
        start_line: { type: "number", description: "Start line number" },
        end_line: { type: "number", description: "End line number" },
        severity: { type: "string", enum: ["high", "medium", "low"], description: "Issue severity" },
        category: { type: "string", description: "Issue category (e.g., bug, security, performance)" },
        summary: { type: "string", description: "Brief summary of the issue" },
        explanation: { type: "string", description: "Detailed explanation" },
        evidence: { type: "string", description: "Code snippet or evidence" },
        suggestion: { type: "string", description: "Suggested fix" }
      },
      required: ["file", "severity", "summary", "explanation"]
    }
  },
  {
    name: "file_read_diff" as const,
    description: "Get the diff content for a specific changed file, or a summary of all changed files if no path is specified.",
    parameters: { type: "object", properties: { path: { type: "string", description: "Optional file path to get diff for. If omitted, returns summary of all changes." } } }
  },
  {
    name: "task_done" as const,
    description: "Signal that the review task is complete. Call this when you have finished reviewing the code.",
    parameters: { type: "object", properties: {} }
  }
];
