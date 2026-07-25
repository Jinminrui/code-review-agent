import type { ChatMessage, ChatResponse, LlmProvider } from "../../domain/provider.js";
import type { ReviewFinding } from "../../domain/review-finding.js";
import type { ToolCall, ToolDefinition } from "../../domain/tool.js";
import { logger } from "../logging/logger.js";
import type { ToolExecutorContext } from "./tool-executors.js";
import { executeToolCall, REVIEW_TOOL_DEFINITIONS } from "./tool-executors.js";

export type ToolUseLoopInput = {
  provider: Pick<LlmProvider, "id" | "chat">;
  systemPrompt: string;
  initialUserMessage: string;
  toolExecutorContext: ToolExecutorContext;
  tools?: ToolDefinition[];
  maxRounds?: number;
  signal?: AbortSignal;
  onToolCall?: (call: ToolCall) => void;
  onRoundComplete?: (round: number, toolName: string) => void;
};

export type ToolUseLoopResult = {
  findings: ReviewFinding[];
  messages: ChatMessage[];
  totalRounds: number;
  usage?: { inputTokens: number; outputTokens: number };
};

const DEFAULT_MAX_ROUNDS = 20;

export async function runToolUseLoop(input: ToolUseLoopInput): Promise<ToolUseLoopResult> {
  const {
    provider,
    systemPrompt,
    initialUserMessage,
    toolExecutorContext,
    tools = REVIEW_TOOL_DEFINITIONS,
    maxRounds = DEFAULT_MAX_ROUNDS,
    signal,
    onToolCall,
    onRoundComplete
  } = input;

  const log = logger.child({ provider: provider.id });

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: initialUserMessage }
  ];

  const findings: ReviewFinding[] = [];
  let totalUsage: { inputTokens: number; outputTokens: number } | undefined;
  let round = 0;

  // 模型通过工具逐步补齐上下文；限制最大轮次，避免异常响应导致会话无限运行。
  while (round < maxRounds) {
    if (signal?.aborted) break;

    const t0 = Date.now();
    const response: ChatResponse = await provider.chat({ messages, tools, signal });

    if (response.usage) {
      totalUsage = totalUsage
        ? { inputTokens: totalUsage.inputTokens + response.usage.inputTokens, outputTokens: totalUsage.outputTokens + response.usage.outputTokens }
        : response.usage;
    }

    if (!response.toolCalls || response.toolCalls.length === 0) {
      // 没有工具调用表示模型已结束当前单元；保留文本消息便于审查轨迹回看。
      if (response.content) messages.push({ role: "assistant", content: response.content });
      break;
    }

    messages.push({ role: "assistant", content: response.content, toolCalls: response.toolCalls });

    for (const toolCall of response.toolCalls) {
      if (signal?.aborted) break;
      onToolCall?.(toolCall);

      if (toolCall.name === "task_done") {
        // task_done 是模型明确声明审查完成的信号，立即结束当前单元。
        log.info(`第 ${round + 1} 轮: 任务完成`);
        onRoundComplete?.(round, "task_done");
        return { findings, messages, totalRounds: round + 1, usage: totalUsage };
      }

      const result = await executeToolCall(toolCall, toolExecutorContext);

      if (toolCall.name === "code_comment") {
        // 评论工具的参数是跨 provider 的中间格式，先转成稳定的 ReviewFinding。
        const finding = parseCodeComment(toolCall.arguments, toolExecutorContext);
        if (finding) {
          findings.push(finding);
          log.info(`发现 ${finding.severity} 级问题: ${finding.file} - ${finding.summary}`);
        }
      }

      messages.push({ role: "tool", toolCallId: toolCall.id, content: result.content });
      onRoundComplete?.(round, toolCall.name);
    }

    round++;
    log.debug(`第 ${round} 轮完成: ${Date.now() - t0}ms`);
  }

  log.info(`循环结束: ${round} 轮, ${findings.length} 个问题`);
  return { findings, messages, totalRounds: round, usage: totalUsage };
}

function parseCodeComment(
  args: Record<string, unknown>,
  context: ToolExecutorContext
): ReviewFinding | null {
  const summary = args.summary as string | undefined;
  const explanation = args.explanation as string | undefined;
  if (!summary || !explanation) return null;

  return {
    id: crypto.randomUUID(),
    severity: (args.severity as "high" | "medium" | "low") ?? "medium",
    category: (args.category as string) ?? "general",
    summary,
    explanation,
    file: (args.file as string) ?? "",
    startLine: args.start_line as number | undefined,
    endLine: args.end_line as number | undefined,
    evidence: args.evidence as string | undefined,
    suggestion: args.suggestion as string | undefined,
    confidenceSignals: [],
    status: args.start_line ? "line-level" : "file-level"
  };
}
