import { describe, expect, it } from "vitest";
import type { PhaseBudget } from "../src/domain/review-runtime.js";
import type { ToolCall, ToolResult } from "../src/domain/tool.js";
import { PlanAuthorizer } from "../src/infrastructure/llm/plan-authorizer.js";

const budget: PhaseBudget = {
  modelCalls: 2,
  toolCalls: 4,
  maxInputTokens: 100,
  maxOutputTokens: 50,
  maxReadBytes: 64,
  maxDurationMs: 10_000
};

function createAuthorizer(overrides: Partial<PhaseBudget> = {}) {
  return new PlanAuthorizer({
    checkId: "check-auth",
    allowedFiles: ["src/auth.ts", "src/user.ts"],
    evidenceTargets: ["authorize request", "AuthService"],
    budget: { ...budget, ...overrides }
  });
}

function call(name: ToolCall["name"], args: Record<string, unknown>, id = `call-${name}`): ToolCall {
  return { id, name, arguments: args };
}

describe("PlanAuthorizer", () => {
  it.each([
    call("file_read", { path: "src/auth.ts" }),
    call("file_find", { keyword: "AuthService" }),
    call("code_search", { pattern: "authorize" }),
    call("file_read_diff", { path: "src/user.ts" })
  ])("允许计划范围内的只读工具：$name", (toolCall) => {
    const decision = createAuthorizer().authorize(toolCall);

    expect(decision).toMatchObject({
      decision: "allow",
      reason: { code: "allowed" },
      checkId: "check-auth",
      toolCallId: toolCall.id,
      auditArguments: toolCall.arguments,
      duplicate: false
    });
  });

  it.each(["code_comment", "task_done"] as const)("拒绝非只读工具：%s", (name) => {
    const decision = createAuthorizer().authorize(call(name, {}));

    expect(decision).toMatchObject({
      decision: "deny",
      reason: { code: "tool-not-read-only" }
    });
  });

  it("拒绝读取计划未授权的文件", () => {
    const decision = createAuthorizer().authorize(
      call("file_read", { path: "src/secrets.ts" })
    );

    expect(decision).toMatchObject({
      decision: "deny",
      reason: { code: "file-not-authorized" }
    });
  });

  it.each([
    call("file_find", { keyword: "payment" }),
    call("code_search", { pattern: "deleteAccount" })
  ])("拒绝与证据目标无关的搜索：$name", (toolCall) => {
    const decision = createAuthorizer().authorize(toolCall);

    expect(decision).toMatchObject({
      decision: "deny",
      reason: { code: "search-target-not-relevant" }
    });
  });

  it("拒绝包含无关分支的混合 regex 搜索", () => {
    const decision = createAuthorizer().authorize(
      call("code_search", { pattern: "AuthService|password", regex: true })
    );

    expect(decision).toMatchObject({
      decision: "deny",
      reason: { code: "search-target-not-relevant" }
    });
  });

  it.each(["AuthService|.*", ".*", "^$"])(
    "拒绝包含无意义通配分支的 regex：%s",
    (pattern) => {
      const decision = createAuthorizer().authorize(
        call("code_search", { pattern, regex: true })
      );

      expect(decision).toMatchObject({
        decision: "deny",
        reason: { code: "search-target-not-relevant" }
      });
    }
  );

  it.each(["[AuthService]", "[A]"])(
    "拒绝宽泛字符类 regex：%s",
    (pattern) => {
      const decision = createAuthorizer().authorize(
        call("code_search", { pattern, regex: true })
      );

      expect(decision).toMatchObject({
        decision: "deny",
        reason: { code: "search-target-not-relevant" }
      });
    }
  );

  it.each(["(AuthService)?", "(AuthService)*", "(AuthService){0}"])(
    "拒绝可匹配空串的相关 regex：%s",
    (pattern) => {
      const decision = createAuthorizer().authorize(
        call("code_search", { pattern, regex: true })
      );

      expect(decision).toMatchObject({
        decision: "deny",
        reason: { code: "search-target-not-relevant" }
      });
    }
  );

  it.each(["(AuthService)?.+", "(AuthService){0}.+", "(AuthService){0,1}.+"])(
    "拒绝关联 token 可选但整体仍可匹配的 regex：%s",
    (pattern) => {
      const decision = createAuthorizer().authorize(
        call("code_search", { pattern, regex: true })
      );

      expect(decision).toMatchObject({
        decision: "deny",
        reason: { code: "search-target-not-relevant" }
      });
    }
  );

  it("拒绝包含嵌套分组语法的 regex", () => {
    const decision = createAuthorizer().authorize(
      call("code_search", { pattern: "((AuthService)+)", regex: true })
    );

    expect(decision).toMatchObject({
      decision: "deny",
      reason: { code: "search-target-not-relevant" }
    });
  });

  it.each(["AuthService+", "AuthService{1,}"])(
    "允许至少匹配一次相关文字的 regex：%s",
    (pattern) => {
      const decision = createAuthorizer().authorize(
        call("code_search", { pattern, regex: true })
      );

      expect(decision).toMatchObject({
        decision: "allow",
        reason: { code: "allowed" }
      });
    }
  );

  it("拒绝未授权的 diff 路径", () => {
    const decision = createAuthorizer().authorize(
      call("file_read_diff", { path: "src/secrets.ts" })
    );

    expect(decision).toMatchObject({
      decision: "deny",
      reason: { code: "file-not-authorized" }
    });
  });

  it("达到工具调用预算后拒绝后续调用", () => {
    const authorizer = createAuthorizer({ toolCalls: 1 });

    expect(authorizer.authorize(call("file_read", { path: "src/auth.ts" }, "first")).decision).toBe("allow");
    expect(authorizer.authorize(call("file_read_diff", { path: "src/auth.ts" }, "second"))).toMatchObject({
      decision: "deny",
      reason: { code: "tool-call-budget-exhausted" }
    });
  });

  it("累计读取字节和 token，并在预算耗尽后拒绝后续调用", () => {
    const authorizer = createAuthorizer({ maxReadBytes: 5, maxInputTokens: 10, maxOutputTokens: 5 });
    const first = authorizer.authorize(call("file_read", { path: "src/auth.ts" }, "first"));
    const result: ToolResult = { toolCallId: "first", content: "你好" };

    authorizer.recordResult(first, result);
    authorizer.recordTokenUsage({ inputTokens: 10, outputTokens: 3 });

    expect(authorizer.getUsage()).toEqual({
      toolCalls: 1,
      readBytes: 6,
      inputTokens: 10,
      outputTokens: 3
    });
    expect(authorizer.authorize(call("file_read_diff", { path: "src/auth.ts" }, "read-over"))).toMatchObject({
      decision: "deny",
      reason: { code: "read-byte-budget-exhausted" }
    });

    const tokenAuthorizer = createAuthorizer({ maxInputTokens: 10 });
    tokenAuthorizer.recordTokenUsage({ inputTokens: 10, outputTokens: 0 });
    expect(tokenAuthorizer.authorize(call("file_read", { path: "src/auth.ts" }, "token-over"))).toMatchObject({
      decision: "deny",
      reason: { code: "input-token-budget-exhausted" }
    });
  });

  it("仅耗尽 output token 预算时拒绝后续调用", () => {
    const authorizer = createAuthorizer({ maxInputTokens: 100, maxOutputTokens: 5 });
    authorizer.recordTokenUsage({ inputTokens: 1, outputTokens: 5 });

    expect(authorizer.authorize(call("file_read", { path: "src/auth.ts" }))).toMatchObject({
      decision: "deny",
      reason: { code: "output-token-budget-exhausted" }
    });
  });

  it("对参数键顺序不同的重复读取进行确定性去重且不重复计费", () => {
    const authorizer = createAuthorizer();
    const first = authorizer.authorize(
      call("file_read", { path: "src/auth.ts", start_line: 1, end_line: 20 }, "first")
    );
    authorizer.recordResult(first, { toolCallId: "first", content: "cached content" });

    const duplicate = authorizer.authorize(
      call("file_read", { end_line: 20, start_line: 1, path: "src/auth.ts" }, "second")
    );

    expect(duplicate).toMatchObject({
      decision: "allow",
      reason: { code: "duplicate-read" },
      duplicate: true,
      cachedResult: { content: "cached content" }
    });
    expect(authorizer.getUsage()).toEqual({
      toolCalls: 1,
      readBytes: 14,
      inputTokens: 0,
      outputTokens: 0
    });
  });
});
