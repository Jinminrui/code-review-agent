/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { PlanAuthorizer } from "../src/infrastructure/llm/plan-authorizer.js";
import {
  executeToolCall,
  READ_ONLY_REVIEW_TOOL_DEFINITIONS,
  REVIEW_TOOL_DEFINITIONS
} from "../src/infrastructure/llm/tool-executors.js";

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

describe("executeToolCall repository file index retry", () => {
  it("lsFiles 失败后删除 WeakMap 缓存，允许同一 GitClient 二次调用重试", async () => {
    const lsFiles = vi
      .fn()
      .mockRejectedValueOnce(new Error("index unavailable"))
      .mockResolvedValueOnce(["src/auth.ts"]);
    const grep = vi.fn().mockResolvedValue(["src/auth.ts:1:AuthService"]);
    const gitClient = {
      readFileAtRef: vi.fn(),
      lsFiles,
      grep,
      readDiff: vi.fn(),
      readWorkspaceDiff: vi.fn()
    };
    const context = {
      gitClient,
      baseRef: "HEAD~1",
      targetRef: "HEAD",
      repositoryPath: "/repo"
    };
    const authorizer = new PlanAuthorizer({
      checkId: "check-auth",
      allowedFiles: ["src/auth.ts"],
      evidenceTargets: ["AuthService"],
      budget: {
        modelCalls: 1,
        toolCalls: 2,
        maxInputTokens: 100,
        maxOutputTokens: 50,
        maxReadBytes: 1024,
        maxDurationMs: 1000
      }
    });
    const firstCall = { id: "search-1", name: "code_search" as const, arguments: { pattern: "AuthService" } };
    const secondCall = { id: "search-2", name: "code_search" as const, arguments: { pattern: "AuthService" } };

    const first = await executeToolCall(firstCall, context, authorizer.authorize(firstCall));
    const second = await executeToolCall(secondCall, context, authorizer.authorize(secondCall));

    expect(first.isError).toBe(true);
    expect(second.isError).toBeUndefined();
    expect(second.content).toContain("AuthService");
    expect(lsFiles).toHaveBeenCalledTimes(2);
  });
});

describe("executeToolCall signal 传递", () => {
  it("将同一 signal 传给 file_find、file_read、code_search 和 diff Git 操作", async () => {
    const signal = new AbortController().signal;
    const gitClient = {
      readFileAtRef: vi.fn().mockResolvedValue("content"),
      lsFiles: vi.fn().mockResolvedValue(["src/auth.ts"]),
      grep: vi.fn().mockResolvedValue(["src/auth.ts:1:auth"]),
      readDiff: vi.fn().mockResolvedValue([]),
      readWorkspaceDiff: vi.fn().mockResolvedValue([])
    };
    const context = {
      gitClient,
      baseRef: "HEAD~1",
      targetRef: "HEAD",
      repositoryPath: "/repo",
      signal
    };

    await executeToolCall(
      { id: "find", name: "file_find", arguments: { keyword: "auth" } },
      context
    );
    await executeToolCall(
      { id: "read", name: "file_read", arguments: { path: "src/auth.ts" } },
      context
    );
    await executeToolCall(
      { id: "search", name: "code_search", arguments: { pattern: "auth" } },
      context
    );
    await executeToolCall(
      { id: "diff", name: "file_read_diff", arguments: {} },
      context
    );

    expect(gitClient.lsFiles).toHaveBeenCalledWith("*auth*", signal);
    expect(gitClient.readFileAtRef).toHaveBeenCalledWith("HEAD", "src/auth.ts", signal);
    expect(gitClient.grep).toHaveBeenCalledWith(
      "auth",
      { regex: undefined },
      signal
    );
    expect(gitClient.readDiff).toHaveBeenCalledWith("HEAD~1", "HEAD", signal);
  });
});

describe("executeToolCall 授权和审计", () => {
  const context = {
    gitClient: {
      readFileAtRef: vi.fn().mockResolvedValue("export const allowed = true;"),
      lsFiles: vi.fn(),
      grep: vi.fn(),
      readDiff: vi.fn(),
      readWorkspaceDiff: vi.fn()
    },
    baseRef: "HEAD~1",
    targetRef: "HEAD",
    repositoryPath: "/repo"
  };

  it("为工具结果保存 contentHash 和可审计参数", async () => {
    const toolCall = {
      id: "tool-audit",
      name: "file_read" as const,
      arguments: { path: "src/auth.ts", start_line: 1 }
    };
    const authorizer = new PlanAuthorizer({
      checkId: "check-auth",
      allowedFiles: ["src/auth.ts"],
      evidenceTargets: ["auth"],
      budget: {
        modelCalls: 1,
        toolCalls: 1,
        maxInputTokens: 100,
        maxOutputTokens: 50,
        maxReadBytes: 1024,
        maxDurationMs: 1000
      }
    });
    const authorization = authorizer.authorize(toolCall);

    const result = await executeToolCall(toolCall, context, authorization);

    expect(result).toMatchObject({
      toolCallId: "tool-audit",
      auditArguments: { path: "src/auth.ts", start_line: 1 }
    });
    expect(result.contentHash).toBe(
      `sha256:${createHash("sha256").update(result.content).digest("hex")}`
    );
  });

  it("拒绝决策不会执行底层工具", async () => {
    const readFileAtRef = vi.fn();
    const toolCall = {
      id: "tool-denied",
      name: "file_read" as const,
      arguments: { path: "src/secret.ts" }
    };
    const authorizer = new PlanAuthorizer({
      checkId: "check-auth",
      allowedFiles: ["src/auth.ts"],
      evidenceTargets: ["auth"],
      budget: {
        modelCalls: 1,
        toolCalls: 1,
        maxInputTokens: 100,
        maxOutputTokens: 50,
        maxReadBytes: 1024,
        maxDurationMs: 1000
      }
    });

    const result = await executeToolCall(
      toolCall,
      { ...context, gitClient: { ...context.gitClient, readFileAtRef } },
      authorizer.authorize(toolCall)
    );

    expect(result.isError).toBe(true);
    expect(result.content).toContain("file-not-authorized");
    expect(readFileAtRef).not.toHaveBeenCalled();
  });

  it("执行时使用已授权参数，避免授权后参数被替换", async () => {
    const readFileAtRef = vi.fn().mockResolvedValue("allowed content");
    const toolCall = {
      id: "tool-frozen-args",
      name: "file_read" as const,
      arguments: { path: "src/auth.ts" }
    };
    const authorizer = new PlanAuthorizer({
      checkId: "check-auth",
      allowedFiles: ["src/auth.ts"],
      evidenceTargets: ["auth"],
      budget: {
        modelCalls: 1,
        toolCalls: 1,
        maxInputTokens: 100,
        maxOutputTokens: 50,
        maxReadBytes: 1024,
        maxDurationMs: 1000
      }
    });
    const authorization = authorizer.authorize(toolCall);
    toolCall.arguments.path = "src/secret.ts";

    await executeToolCall(
      toolCall,
      { ...context, gitClient: { ...context.gitClient, readFileAtRef } },
      authorization
    );

    expect(readFileAtRef).toHaveBeenCalledWith("HEAD", "src/auth.ts");
  });

  it("code_search 只返回 allowedFiles 中的匹配", async () => {
    const grep = vi.fn().mockResolvedValue([
      "src/auth.ts:10:export class AuthService {}",
      "src/secret.ts:20:const service = new AuthService();"
    ]);
    const lsFiles = vi.fn().mockResolvedValue(["src/auth.ts", "src/secret.ts"]);
    const toolCall = {
      id: "tool-search-scope",
      name: "code_search" as const,
      arguments: { pattern: "AuthService" }
    };
    const authorizer = new PlanAuthorizer({
      checkId: "check-auth",
      allowedFiles: ["src/auth.ts"],
      evidenceTargets: ["AuthService"],
      budget: {
        modelCalls: 1,
        toolCalls: 1,
        maxInputTokens: 100,
        maxOutputTokens: 50,
        maxReadBytes: 1024,
        maxDurationMs: 1000
      }
    });

    const result = await executeToolCall(
      toolCall,
      { ...context, gitClient: { ...context.gitClient, grep, lsFiles } },
      authorizer.authorize(toolCall)
    );

    expect(result.content).toContain("src/auth.ts:10:");
    expect(result.content).not.toContain("src/secret.ts:20:");
    expect(grep).toHaveBeenCalledWith("AuthService", {
      regex: undefined,
      paths: ["src/auth.ts"]
    });
  });

  it("授权 file_find 只返回 allowedFiles 交集", async () => {
    const lsFiles = vi.fn().mockResolvedValue([
      "src/auth.ts",
      "src/secret-auth.ts",
      "src/other.ts"
    ]);
    const toolCall = {
      id: "tool-file-find-scope",
      name: "file_find" as const,
      arguments: { keyword: "auth" }
    };
    const authorizer = new PlanAuthorizer({
      checkId: "check-auth",
      allowedFiles: ["src/auth.ts"],
      evidenceTargets: ["auth"],
      budget: {
        modelCalls: 1,
        toolCalls: 2,
        maxInputTokens: 100,
        maxOutputTokens: 50,
        maxReadBytes: 1024,
        maxDurationMs: 1000
      }
    });

    const result = await executeToolCall(
      toolCall,
      { ...context, gitClient: { ...context.gitClient, lsFiles } },
      authorizer.authorize(toolCall)
    );

    expect(result.content).toBe("src/auth.ts");
    expect(lsFiles).toHaveBeenCalledWith();
  });

  it("授权搜索复用同一仓库文件集合，避免重复 lsFiles", async () => {
    const lsFiles = vi.fn().mockResolvedValue(["src/auth.ts"]);
    const grep = vi.fn()
      .mockResolvedValueOnce(["src/auth.ts:1:AuthService"])
      .mockResolvedValueOnce(["src/auth.ts:2:AuthService"]);
    const gitClient = { ...context.gitClient, lsFiles, grep };
    const toolContext = { ...context, gitClient };
    const authorizer = new PlanAuthorizer({
      checkId: "check-auth",
      allowedFiles: ["src/auth.ts"],
      evidenceTargets: ["auth"],
      budget: {
        modelCalls: 1,
        toolCalls: 2,
        maxInputTokens: 100,
        maxOutputTokens: 50,
        maxReadBytes: 1024,
        maxDurationMs: 1000
      }
    });

    await executeToolCall(
      { id: "find", name: "file_find", arguments: { keyword: "auth" } },
      toolContext,
      authorizer.authorize({ id: "find", name: "file_find", arguments: { keyword: "auth" } })
    );
    await executeToolCall(
      { id: "search", name: "code_search", arguments: { pattern: "AuthService" } },
      toolContext,
      authorizer.authorize({ id: "search", name: "code_search", arguments: { pattern: "AuthService" } })
    );

    expect(lsFiles).toHaveBeenCalledTimes(1);
  });

  it("code_search 用仓库文件列表消歧数字冒号文件名", async () => {
    const grep = vi.fn().mockResolvedValue([
      "src/archive:2024:5:const leaked = new AuthService();",
      "src/allowed:2024:6:export class AuthService {}"
    ]);
    const lsFiles = vi.fn().mockResolvedValue([
      "src/archive",
      "src/archive:2024",
      "src/allowed:2024"
    ]);
    const toolCall = {
      id: "tool-search-colon-path",
      name: "code_search" as const,
      arguments: { pattern: "AuthService" }
    };
    const authorizer = new PlanAuthorizer({
      checkId: "check-auth",
      allowedFiles: ["src/archive", "src/allowed:2024"],
      evidenceTargets: ["AuthService"],
      budget: {
        modelCalls: 1,
        toolCalls: 1,
        maxInputTokens: 100,
        maxOutputTokens: 50,
        maxReadBytes: 1024,
        maxDurationMs: 1000
      }
    });

    const result = await executeToolCall(
      toolCall,
      { ...context, gitClient: { ...context.gitClient, grep, lsFiles } },
      authorizer.authorize(toolCall)
    );

    expect(result.content).toBe(
      "src/allowed:2024:6:export class AuthService {}"
    );
    expect(result.content).not.toContain("leaked");
  });

  it("code_search 对无法唯一解析的数字冒号路径安全降级", async () => {
    const grep = vi.fn().mockResolvedValue([
      "src/archive:2024:5:leaked from the unauthorized shorter path"
    ]);
    const lsFiles = vi.fn().mockResolvedValue([
      "src/archive",
      "src/archive:2024"
    ]);
    const toolCall = {
      id: "tool-search-ambiguous-path",
      name: "code_search" as const,
      arguments: { pattern: "AuthService" }
    };
    const authorizer = new PlanAuthorizer({
      checkId: "check-auth",
      allowedFiles: ["src/archive:2024"],
      evidenceTargets: ["AuthService"],
      budget: {
        modelCalls: 1,
        toolCalls: 1,
        maxInputTokens: 100,
        maxOutputTokens: 50,
        maxReadBytes: 1024,
        maxDurationMs: 1000
      }
    });

    const result = await executeToolCall(
      toolCall,
      { ...context, gitClient: { ...context.gitClient, grep, lsFiles } },
      authorizer.authorize(toolCall)
    );

    expect(result.content).toBe("No matches found.");
  });

  it("file_read_diff 无 path 时只汇总 allowedFiles", async () => {
    const toolCall = {
      id: "tool-diff-summary-scope",
      name: "file_read_diff" as const,
      arguments: {}
    };
    const authorizer = new PlanAuthorizer({
      checkId: "check-auth",
      allowedFiles: ["src/auth.ts"],
      evidenceTargets: ["AuthService"],
      budget: {
        modelCalls: 1,
        toolCalls: 1,
        maxInputTokens: 100,
        maxOutputTokens: 50,
        maxReadBytes: 1024,
        maxDurationMs: 1000
      }
    });

    const result = await executeToolCall(
      toolCall,
      {
        ...context,
        diffFiles: [
          {
            path: "src/auth.ts",
            isNew: false,
            isDeleted: false,
            isBinary: false,
            insertions: 2,
            deletions: 1,
            hunks: []
          },
          {
            path: "src/secret.ts",
            isNew: false,
            isDeleted: false,
            isBinary: false,
            insertions: 10,
            deletions: 5,
            hunks: []
          }
        ]
      },
      authorizer.authorize(toolCall)
    );

    expect(result.content).toBe("src/auth.ts (+2, -1)");
  });

  it("新路径只暴露四个只读工具，同时保留旧工具定义", () => {
    expect(READ_ONLY_REVIEW_TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual([
      "file_read",
      "file_find",
      "code_search",
      "file_read_diff"
    ]);
    expect(REVIEW_TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual([
      "file_read",
      "file_find",
      "code_search",
      "code_comment",
      "file_read_diff",
      "task_done"
    ]);
  });
});
