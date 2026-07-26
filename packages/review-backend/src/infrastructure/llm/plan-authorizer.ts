import { posix } from "node:path";
import type { PhaseBudget } from "../../domain/review-runtime.js";
import {
  readOnlyToolNameSchema,
  type ReadOnlyToolName,
  type ToolCall,
  type ToolResult
} from "../../domain/tool.js";

export type PlanAuthorizationUsage = {
  toolCalls: number;
  readBytes: number;
  inputTokens: number;
  outputTokens: number;
};

export type PlanAuthorizationReasonCode =
  | "allowed"
  | "duplicate-read"
  | "tool-not-read-only"
  | "file-not-authorized"
  | "search-target-not-relevant"
  | "tool-call-budget-exhausted"
  | "read-byte-budget-exhausted"
  | "input-token-budget-exhausted"
  | "output-token-budget-exhausted";

export type PlanAuthorizationReason = {
  code: PlanAuthorizationReasonCode;
  message: string;
};

type AuthorizationBase = {
  checkId: string;
  toolCallId: string;
  toolName: ToolCall["name"];
  auditArguments: Record<string, unknown>;
  reason: PlanAuthorizationReason;
};

export type PlanAuthorizationAllow = AuthorizationBase & {
  decision: "allow";
  toolName: ReadOnlyToolName;
  allowedFiles: readonly string[];
  allowedFileSet: ReadonlySet<string>;
  duplicate: boolean;
  cacheKey: string;
  cachedResult?: ToolResult;
};

export type PlanAuthorizationDeny = AuthorizationBase & {
  decision: "deny";
};

export type PlanAuthorizationDecision =
  | PlanAuthorizationAllow
  | PlanAuthorizationDeny;

export type PlanAuthorizerOptions = {
  checkId: string;
  allowedFiles: readonly string[];
  evidenceTargets: readonly string[];
  budget: PhaseBudget;
};

const EMPTY_USAGE: PlanAuthorizationUsage = {
  toolCalls: 0,
  readBytes: 0,
  inputTokens: 0,
  outputTokens: 0
};

export class PlanAuthorizer {
  private readonly checkId: string;
  private readonly allowedFiles: Set<string>;
  private readonly allowedFileList: readonly string[];
  private readonly evidenceTargets: readonly string[];
  private readonly budget: PhaseBudget;
  private readonly cachedReads = new Map<string, ToolResult>();
  private readonly usage: PlanAuthorizationUsage = { ...EMPTY_USAGE };

  constructor(options: PlanAuthorizerOptions) {
    this.checkId = options.checkId;
    this.allowedFiles = new Set(options.allowedFiles.map(normalizeRepositoryPath));
    this.allowedFileList = Object.freeze([...this.allowedFiles]);
    this.evidenceTargets = options.evidenceTargets;
    this.budget = options.budget;
  }

  authorize(toolCall: ToolCall): PlanAuthorizationDecision {
    const auditArguments = normalizeArguments(toolCall.arguments);
    const base = {
      checkId: this.checkId,
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      auditArguments
    };
    const parsedName = readOnlyToolNameSchema.safeParse(toolCall.name);

    if (!parsedName.success) {
      return deny(base, "tool-not-read-only", `工具 ${toolCall.name} 不在只读白名单中`);
    }

    const scopeDenial = this.validateScope(parsedName.data, auditArguments);
    if (scopeDenial) {
      return { ...base, decision: "deny", reason: scopeDenial };
    }

    const cacheKey = createCacheKey(this.checkId, parsedName.data, auditArguments);
    if (isReadTool(parsedName.data)) {
      const cachedResult = this.cachedReads.get(cacheKey);
      if (cachedResult) {
        return {
          ...base,
          toolName: parsedName.data,
          allowedFiles: this.allowedFileList,
          allowedFileSet: this.allowedFiles,
          decision: "allow",
          reason: reason("duplicate-read", "相同检查项和参数的读取已命中缓存"),
          duplicate: true,
          cacheKey,
          cachedResult: { ...cachedResult }
        };
      }
    }

    const budgetDenial = this.validateBudget();
    if (budgetDenial) {
      return { ...base, decision: "deny", reason: budgetDenial };
    }

    this.usage.toolCalls += 1;
    return {
      ...base,
      toolName: parsedName.data,
      allowedFiles: this.allowedFileList,
      allowedFileSet: this.allowedFiles,
      decision: "allow",
      reason: reason("allowed", "工具调用在计划范围和预算内"),
      duplicate: false,
      cacheKey
    };
  }

  recordResult(decision: PlanAuthorizationDecision, result: ToolResult): PlanAuthorizationUsage {
    if (decision.decision === "deny" || decision.duplicate) {
      return this.getUsage();
    }

    this.usage.readBytes += Buffer.byteLength(result.content, "utf8");
    if (isReadTool(decision.toolName)) {
      this.cachedReads.set(decision.cacheKey, { ...result });
    }
    return this.getUsage();
  }

  recordTokenUsage(usage: { inputTokens: number; outputTokens: number }): PlanAuthorizationUsage {
    this.usage.inputTokens += Math.max(0, usage.inputTokens);
    this.usage.outputTokens += Math.max(0, usage.outputTokens);
    return this.getUsage();
  }

  getUsage(): PlanAuthorizationUsage {
    return { ...this.usage };
  }

  private validateScope(
    toolName: ReadOnlyToolName,
    args: Record<string, unknown>
  ): PlanAuthorizationReason | undefined {
    if (toolName === "file_read" || toolName === "file_read_diff") {
      const path = args.path;
      if (toolName === "file_read_diff" && path === undefined) {
        return undefined;
      }
      if (typeof path !== "string" || !this.allowedFiles.has(normalizeRepositoryPath(path))) {
        return reason("file-not-authorized", `文件 ${String(path)} 不在当前检查项授权范围内`);
      }
    }

    if (toolName === "file_find" || toolName === "code_search") {
      const target = toolName === "file_find" ? args.keyword : args.pattern;
      const requireEveryToken = toolName === "code_search" && args.regex === true;
      if (
        typeof target !== "string" ||
        !isRelevantSearchTarget(target, this.evidenceTargets, requireEveryToken)
      ) {
        return reason("search-target-not-relevant", `搜索目标 ${String(target)} 与当前检查项无关`);
      }
    }

    return undefined;
  }

  private validateBudget(): PlanAuthorizationReason | undefined {
    if (this.usage.readBytes >= this.budget.maxReadBytes) {
      return reason("read-byte-budget-exhausted", "读取字节预算已耗尽");
    }
    if (this.usage.inputTokens >= this.budget.maxInputTokens) {
      return reason("input-token-budget-exhausted", "输入 token 预算已耗尽");
    }
    if (this.usage.outputTokens >= this.budget.maxOutputTokens) {
      return reason("output-token-budget-exhausted", "输出 token 预算已耗尽");
    }
    if (this.usage.toolCalls >= this.budget.toolCalls) {
      return reason("tool-call-budget-exhausted", "工具调用预算已耗尽");
    }
    return undefined;
  }
}

function deny(
  base: Omit<AuthorizationBase, "reason">,
  code: PlanAuthorizationReasonCode,
  message: string
): PlanAuthorizationDeny {
  return { ...base, decision: "deny", reason: reason(code, message) };
}

function reason(code: PlanAuthorizationReasonCode, message: string): PlanAuthorizationReason {
  return { code, message };
}

function isReadTool(toolName: ReadOnlyToolName): boolean {
  return toolName === "file_read" || toolName === "file_read_diff";
}

function normalizeRepositoryPath(path: string): string {
  return posix.normalize(path.replaceAll("\\", "/")).replace(/^\.\//, "");
}

function normalizeArguments(args: Record<string, unknown>): Record<string, unknown> {
  const normalized = sortValue(args) as Record<string, unknown>;
  if (typeof normalized.path === "string") {
    normalized.path = normalizeRepositoryPath(normalized.path);
  }
  return normalized;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortValue(entry)])
    );
  }
  return value;
}

function createCacheKey(
  checkId: string,
  toolName: ReadOnlyToolName,
  args: Record<string, unknown>
): string {
  return `${checkId}:${toolName}:${JSON.stringify(args)}`;
}

function isRelevantSearchTarget(
  target: string,
  evidenceTargets: readonly string[],
  requireEveryToken = false
): boolean {
  const normalizedEvidenceTargets = evidenceTargets
    .map(normalizeSearchText)
    .filter(Boolean);
  if (requireEveryToken) {
    if (hasUnescapedRegexSyntax(target)) return false;
    if (regexMatchesEmptyString(target)) return false;
    return splitRegexAlternatives(target).every((alternative) => {
      const targetTokens = normalizeSearchText(
        alternative.replace(/\\[dDsSwWbB]/g, " ")
      )
        .split(" ")
        .filter((token) => /\p{L}/u.test(token));
      return targetTokens.length > 0 && targetTokens.every((targetToken) =>
        normalizedEvidenceTargets.some((evidenceTarget) =>
          evidenceTarget.split(" ").some((evidenceToken) =>
            tokensRelated(targetToken, evidenceToken)
          )
        )
      );
    });
  }

  const normalizedTarget = normalizeSearchText(target);
  if (!normalizedTarget) return false;
  return normalizedEvidenceTargets.some((normalizedEvidence) => {
    if (
      normalizedEvidence.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedEvidence)
    ) {
      return true;
    }

    return normalizedTarget.split(" ").some((targetToken) =>
      normalizedEvidence.split(" ").some((evidenceToken) =>
        tokensRelated(targetToken, evidenceToken)
      )
    );
  });
}

function hasUnescapedRegexSyntax(pattern: string): boolean {
  let escaped = false;

  for (const character of pattern) {
    if (escaped) {
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if ("()[]".includes(character)) {
      return true;
    }
  }

  return false;
}

function regexMatchesEmptyString(pattern: string): boolean {
  try {
    return new RegExp(pattern).test("");
  } catch {
    // 无法确定语义的 regex 按拒绝处理，避免授权器与执行器解释不一致。
    return true;
  }
}

function splitRegexAlternatives(pattern: string): string[] {
  const alternatives: string[] = [];
  let current = "";
  let escaped = false;

  for (const character of pattern) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\") {
      current += character;
      escaped = true;
    } else if (character === "|") {
      alternatives.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  alternatives.push(current);
  return alternatives;
}

function normalizeSearchText(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokensRelated(left: string, right: string): boolean {
  if (left === right) return true;
  const prefixLength = Math.min(left.length, right.length, 7);
  return prefixLength >= 4 && left.slice(0, prefixLength) === right.slice(0, prefixLength);
}
