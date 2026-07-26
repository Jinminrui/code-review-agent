/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { createHash } from "node:crypto";
import { executableToolNameSchema } from "../../domain/tool.js";
import type { ExecutableToolName, ToolCall, ToolDefinition, ToolResult, ToolName } from "../../domain/tool.js";
import type { GitClient } from "../git/git-client.js";
import type { ParsedDiffFile } from "../git/parse-unified-diff.js";
import { logger } from "../logging/logger.js";
import type { PlanAuthorizationDecision } from "./plan-authorizer.js";

export type ToolExecutorContext = {
  gitClient: Pick<GitClient, "readFileAtRef" | "lsFiles" | "grep" | "readDiff" | "readWorkspaceDiff">;
  signal?: AbortSignal;
  baseRef: string;
  targetRef: string;
  repositoryPath: string;
  diffFiles?: ParsedDiffFile[];
  allowedFiles?: readonly string[];
  allowedFileSet?: ReadonlySet<string>;
};

export type ToolExecutor = (
  args: Record<string, unknown>,
  context: ToolExecutorContext
) => Promise<ToolResult>;

const log = logger.child({ component: "tool" });
type RepositoryFileIndex = {
  files: ReadonlySet<string>;
};

const repositoryFileIndexes = new WeakMap<object, Promise<RepositoryFileIndex>>();

const fileReadExecutor: ToolExecutor = async (args, context) => {
  const path = args.path as string;
  if (!path) return { toolCallId: "", content: "Error: 'path' parameter is required", isError: true };

  try {
    let content = await readFileAtRef(context, context.targetRef, path);

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
    const files = context.allowedFileSet
      ? (context.allowedFileSet.size === 0
        ? []
        : [...(await getRepositoryFileIndex(context)).files].filter((file) =>
            context.allowedFileSet!.has(file) && file.includes(keyword)
          ))
      : await lsFiles(context, `*${keyword}*`);
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
    if (context.allowedFileSet?.size === 0) {
      return { toolCallId: "", content: "No matches found." };
    }
    const results = await grep(context, pattern, {
      regex,
      ...(context.allowedFiles ? { paths: context.allowedFiles } : {})
    });
    const repositoryFileIndex = context.allowedFileSet
      ? await getRepositoryFileIndex(context)
      : undefined;
    const allowedResults = filterSearchResults(
      results,
      context.allowedFileSet,
      repositoryFileIndex?.files
    );
    log.debug(`代码搜索: ${pattern} -> ${allowedResults.length} 个授权匹配`);
    if (allowedResults.length === 0) return { toolCallId: "", content: "No matches found." };
    const capped = allowedResults.slice(0, 100);
    const extra = allowedResults.length > 100 ? `\n... (${allowedResults.length - 100} more matches truncated)` : "";
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
    const diffFiles = context.diffFiles ?? (context.targetRef === "WORKSPACE"
      ? await readWorkspaceDiff(context)
      : await readDiff(context, context.baseRef, context.targetRef));
    const allowedDiffFiles = filterDiffFiles(diffFiles, context.allowedFileSet);

    if (path) {
      const file = allowedDiffFiles.find((f) => f.path === path);
      if (!file) return { toolCallId: "", content: `No diff found for file: ${path}` };
      log.debug(`读取 diff: ${path}`);
      return { toolCallId: "", content: formatDiffFile(file) };
    }

    const summary = allowedDiffFiles.map((f) => `${f.path} (+${f.insertions}, -${f.deletions})`).join("\n");
    log.debug(`读取 diff 摘要: ${allowedDiffFiles.length} 个授权文件`);
    return { toolCallId: "", content: summary || "No changes found." };
  } catch (error) {
    log.warn(`读取 diff 失败`);
    return { toolCallId: "", content: `Error reading diff: ${error instanceof Error ? error.message : "unknown error"}`, isError: true };
  }
};

function formatDiffFile(file: ParsedDiffFile): string {
  const diffText = file.hunks
    .map((h) => {
      const lines = h.lines.map((l) => {
        const prefix = l.type === "added" ? "+" : l.type === "deleted" ? "-" : " ";
        return prefix + l.content;
      });
      return `@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@\n${lines.join("\n")}`;
    })
    .join("\n");

  return `--- a/${file.path}\n+++ b/${file.path}\n${diffText}`;
}

function filterSearchResults(
  results: readonly string[],
  allowedFileSet?: ReadonlySet<string>,
  repositoryFiles?: ReadonlySet<string>
): string[] {
  if (!allowedFileSet) return [...results];
  return results.filter((result) => {
    const file = repositoryFiles
      ? findUniqueSearchResultFile(result, repositoryFiles)
      : undefined;
    return file !== undefined && allowedFileSet.has(file);
  });
}

function getRepositoryFileIndex(context: ToolExecutorContext): Promise<RepositoryFileIndex> {
  const cacheKey = context.gitClient as object;
  const cached = repositoryFileIndexes.get(cacheKey);
  if (cached) return cached;

  const indexPromise = lsFiles(context)
    .then((files) => ({
      files: new Set(files)
    }))
    .catch((error) => {
      // 失败或取消的索引不能污染缓存，否则同一仓库后续无法重试。
      if (repositoryFileIndexes.get(cacheKey) === indexPromise) {
        repositoryFileIndexes.delete(cacheKey);
      }
      throw error;
    });
  repositoryFileIndexes.set(cacheKey, indexPromise);
  return indexPromise;
}

function readFileAtRef(
  context: ToolExecutorContext,
  ref: string,
  path: string
): Promise<string> {
  return context.signal
    ? context.gitClient.readFileAtRef(ref, path, context.signal)
    : context.gitClient.readFileAtRef(ref, path);
}

function lsFiles(context: ToolExecutorContext, pattern?: string): Promise<string[]> {
  if (context.signal) return context.gitClient.lsFiles(pattern, context.signal);
  return pattern === undefined
    ? context.gitClient.lsFiles()
    : context.gitClient.lsFiles(pattern);
}

function grep(
  context: ToolExecutorContext,
  pattern: string,
  options: { regex?: boolean; paths?: readonly string[] }
): Promise<string[]> {
  return context.signal
    ? context.gitClient.grep(pattern, options, context.signal)
    : context.gitClient.grep(pattern, options);
}

function readDiff(
  context: ToolExecutorContext,
  baseRef: string,
  targetRef: string
) {
  return context.signal
    ? context.gitClient.readDiff(baseRef, targetRef, context.signal)
    : context.gitClient.readDiff(baseRef, targetRef);
}

function readWorkspaceDiff(context: ToolExecutorContext) {
  return context.signal
    ? context.gitClient.readWorkspaceDiff(context.signal)
    : context.gitClient.readWorkspaceDiff();
}

function findUniqueSearchResultFile(
  result: string,
  repositoryFiles: ReadonlySet<string>
): string | undefined {
  let match: string | undefined;

  for (let index = 0; index < result.length; index += 1) {
    if (result[index] === ":") {
      let lineSeparator = index + 1;
      while (/\d/.test(result[lineSeparator] ?? "")) {
        lineSeparator += 1;
      }
      if (
        lineSeparator > index + 1 &&
        result[lineSeparator] === ":"
      ) {
        const candidate = result.slice(0, index);
        if (repositoryFiles.has(candidate)) {
          if (match !== undefined && match !== candidate) return undefined;
          match = candidate;
        }
      }
    }
  }

  return match;
}

function filterDiffFiles(
  diffFiles: readonly ParsedDiffFile[],
  allowedFileSet?: ReadonlySet<string>
): ParsedDiffFile[] {
  if (!allowedFileSet) return [...diffFiles];
  return diffFiles.filter((file) => allowedFileSet.has(file.path));
}

const taskDoneExecutor: ToolExecutor = async () => {
  return { toolCallId: "", content: "Review task completed." };
};

const executors: Record<ExecutableToolName, ToolExecutor> = {
  file_read: fileReadExecutor,
  file_find: fileFindExecutor,
  code_search: codeSearchExecutor,
  code_comment: codeCommentExecutor,
  file_read_diff: fileReadDiffExecutor,
  task_done: taskDoneExecutor
};

export function executeToolCall(
  toolCall: ToolCall,
  context: ToolExecutorContext,
  authorization?: PlanAuthorizationDecision
): Promise<ToolResult> {
  if (authorization?.decision === "deny") {
    return Promise.resolve(finalizeToolResult(toolCall, {
      toolCallId: toolCall.id,
      content: `Authorization denied: ${authorization.reason.code} - ${authorization.reason.message}`,
      isError: true
    }, authorization.auditArguments));
  }

  if (authorization && (
    authorization.toolCallId !== toolCall.id || authorization.toolName !== toolCall.name
  )) {
    return Promise.resolve(finalizeToolResult(toolCall, {
      toolCallId: toolCall.id,
      content: "Authorization denied: authorization-mismatch",
      isError: true
    }));
  }

  if (authorization?.cachedResult) {
    return Promise.resolve(finalizeToolResult(
      toolCall,
      authorization.cachedResult,
      authorization.auditArguments
    ));
  }

  const executableName = executableToolNameSchema.safeParse(toolCall.name);
  const executor = executableName.success ? executors[executableName.data] : undefined;
  if (!executor) {
    return Promise.resolve(finalizeToolResult(toolCall, {
      toolCallId: toolCall.id,
      content: `Unknown tool: ${toolCall.name}`,
      isError: true
    }));
  }
  const executionArguments = authorization?.auditArguments ?? toolCall.arguments;
  const executionContext = authorization
    ? {
      ...context,
      allowedFiles: authorization.allowedFiles,
      allowedFileSet: authorization.allowedFileSet
    }
    : context;
  return executor(executionArguments, executionContext).then((result) => finalizeToolResult(
    toolCall,
    result,
    authorization?.auditArguments
  ));
}

function finalizeToolResult(
  toolCall: ToolCall,
  result: ToolResult,
  auditArguments: Record<string, unknown> = toolCall.arguments
): ToolResult {
  return {
    ...result,
    toolCallId: toolCall.id,
    contentHash: `sha256:${createHash("sha256").update(result.content).digest("hex")}`,
    auditArguments: { ...auditArguments }
  };
}

export const REVIEW_TOOL_DEFINITIONS = [
  {
    name: "file_read" as const,
    description: "读取指定路径的文件内容。可选 start_line 和 end_line 参数读取指定行范围。内容上限 500 行。",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "相对于仓库根目录的文件路径" },
        start_line: { type: "number", description: "可选，起始行号（从 1 开始）" },
        end_line: { type: "number", description: "可选，结束行号（包含）" }
      },
      required: ["path"]
    }
  },
  {
    name: "file_find" as const,
    description: "按文件名关键词搜索仓库中的文件。",
    parameters: { type: "object", properties: { keyword: { type: "string", description: "文件名搜索关键词" } }, required: ["keyword"] }
  },
  {
    name: "code_search" as const,
    description: "在仓库中搜索文本或正则表达式。返回 file:line:content 格式的匹配结果，最多 100 条。",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "搜索模式" },
        regex: { type: "boolean", description: "是否使用正则表达式模式（默认 false，使用文本匹配）" }
      },
      required: ["pattern"]
    }
  },
  {
    name: "code_comment" as const,
    description: "提交审查发现的问题。请提供文件路径、行范围、严重级别、摘要和详细说明。",
    parameters: {
      type: "object",
      properties: {
        file: { type: "string", description: "文件路径" },
        start_line: { type: "number", description: "起始行号" },
        end_line: { type: "number", description: "结束行号" },
        severity: { type: "string", enum: ["high", "medium", "low"], description: "严重级别：high（高）、medium（中）、low（低）" },
        category: { type: "string", description: "问题类别，如：bug、安全、性能、代码质量" },
        summary: { type: "string", description: "问题摘要" },
        explanation: { type: "string", description: "详细说明" },
        evidence: { type: "string", description: "代码片段或证据" },
        suggestion: { type: "string", description: "修复建议" }
      },
      required: ["file", "severity", "summary", "explanation"]
    }
  },
  {
    name: "file_read_diff" as const,
    description: "获取指定变更文件的 diff 内容，或所有变更文件的摘要。",
    parameters: { type: "object", properties: { path: { type: "string", description: "可选，文件路径。省略则返回所有变更的摘要。" } } }
  },
  {
    name: "task_done" as const,
    description: "表示审查任务已完成。审查结束后调用此工具。",
    parameters: { type: "object", properties: {} }
  }
] satisfies ToolDefinition[];

const READ_ONLY_TOOL_NAMES = new Set<ToolName>([
  "file_read",
  "file_find",
  "code_search",
  "file_read_diff"
]);

// 新运行时只使用此定义；旧 Tool-use loop 继续使用 REVIEW_TOOL_DEFINITIONS。
export const READ_ONLY_REVIEW_TOOL_DEFINITIONS: ToolDefinition[] =
  REVIEW_TOOL_DEFINITIONS.filter((tool) => READ_ONLY_TOOL_NAMES.has(tool.name));
