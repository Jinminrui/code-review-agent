/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import {
  providerCapabilitiesSchema,
  type ChatMessage,
  type ChatResponse,
  type LlmProvider,
  type ProviderCapabilities,
  type ProviderProfile
} from "../../domain/provider.js";
import type { ToolDefinition } from "../../domain/tool.js";
import { logger } from "../logging/logger.js";

const log = logger.child({ component: "llm" });

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;

  constructor(private readonly profile: ProviderProfile) {
    this.id = profile.id;
    const conservativeCapabilities: ProviderCapabilities = {
      structuredOutput: false,
      toolCalling: false,
      usage: false,
      cancellation: false,
      ...(profile.contextWindowTokens === undefined
        ? {}
        : { contextWindowTokens: profile.contextWindowTokens })
    };
    const configuredCapabilities = profile.capabilities ?? conservativeCapabilities;

    // OpenAI-compatible 只描述 wire format，不能据此推断具体服务端能力。
    this.capabilities = providerCapabilitiesSchema.parse(configuredCapabilities);
  }

  async chat(input: {
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    jsonMode?: boolean;
    signal?: AbortSignal;
  }): Promise<ChatResponse> {
    // 内部消息模型与 OpenAI-compatible wire format 不完全相同，这里集中做协议转换。
    const messages = input.messages.map((msg) => {
      if (msg.role === "assistant" && msg.toolCalls) {
        return {
          role: "assistant" as const,
          content: msg.content,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }
          }))
        };
      }
      if (msg.role === "tool") {
        return { role: "tool" as const, tool_call_id: msg.toolCallId, content: msg.content };
      }
      return msg;
    });

    const body: Record<string, unknown> = { model: this.profile.model, messages };
    // 仅在调用方明确要求时启用 JSON 模式，普通工具调用仍保留模型的自然语言能力。
    if (input.jsonMode) {
      body.response_format = { type: "json_object" };
    }
    if (input.tools && input.tools.length > 0) {
      body.tools = input.tools.map((tool) => ({
        type: "function",
        function: { name: tool.name, description: tool.description, parameters: tool.parameters }
      }));
    }

    const t0 = Date.now();
    const response = await fetch(`${this.profile.baseUrl}/chat/completions`, {
      method: "POST",
      signal: input.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.profile.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      log.error(`LLM 请求失败: HTTP ${response.status}, ${Date.now() - t0}ms`);
      throw new Error(`OpenAI-compatible provider request failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
        };
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const choice = payload.choices?.[0]?.message;
    const toolCalls = (choice?.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name as ToolDefinition["name"],
      arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>
    }));

    const tokens = payload.usage ? `${payload.usage.prompt_tokens ?? 0}+${payload.usage.completion_tokens ?? 0}` : "-";
    const tools = toolCalls.map((tc) => tc.name).join(",") || "无";
    log.info(`LLM 完成: ${Date.now() - t0}ms, tools=[${tools}], tokens=${tokens}`);

    return {
      content: choice?.content ?? null,
      toolCalls,
      usage: payload.usage
        ? { inputTokens: payload.usage.prompt_tokens ?? 0, outputTokens: payload.usage.completion_tokens ?? 0 }
        : undefined
    };
  }
}
