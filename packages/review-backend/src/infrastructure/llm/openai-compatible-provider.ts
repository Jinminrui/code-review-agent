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
import OpenAI from "openai";
import { logger } from "../logging/logger.js";

const log = logger.child({ component: "llm" });

export function summarizeOpenAiError(error: unknown): {
  name: string;
  message: string;
  status?: number;
  code?: string;
  requestId?: string;
} {
  const value = error as {
    name?: unknown;
    message?: unknown;
    status?: unknown;
    code?: unknown;
    request_id?: unknown;
    _request_id?: unknown;
  };
  const message = typeof value.message === "string" ? value.message.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").slice(0, 500) : "unknown provider error";
  return {
    name: typeof value.name === "string" ? value.name : "Error",
    message,
    ...(typeof value.status === "number" ? { status: value.status } : {}),
    ...(typeof value.code === "string" ? { code: value.code } : {}),
    ...(typeof value._request_id === "string" || typeof value.request_id === "string"
      ? { requestId: String(value._request_id ?? value.request_id) }
      : {})
  };
}

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  private readonly client: OpenAI;

  constructor(private readonly profile: ProviderProfile) {
    this.id = profile.id;
    this.client = new OpenAI({
      apiKey: profile.apiKey,
      baseURL: profile.baseUrl,
      ...(profile.timeoutMs === undefined ? {} : { timeout: profile.timeoutMs })
    });
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
    jsonSchema?: { name: string; strict: true; schema: Record<string, unknown> };
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
    const hasTools = input.tools !== undefined && input.tools.length > 0;
    // 工具调用和 response_format 是两套输出协议。兼容服务端可能因此把工具参数
    // 当作普通 JSON 文本处理，所以有工具时优先使用 tool calling，不发送 response_format。
    if (!hasTools && input.jsonSchema) {
      if (this.capabilities.structuredOutput !== true) {
        throw new Error("provider 不支持 strict JSON Schema structured output");
      }
      body.response_format = {
        type: "json_schema",
        json_schema: input.jsonSchema
      };
    } else if (!hasTools && input.jsonMode) {
      body.response_format = { type: "json_object" };
    }
    if (input.tools && input.tools.length > 0) {
      if (this.capabilities.toolCalling !== true) {
        throw new Error("provider 不支持 tool calling");
      }
      body.tools = input.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          ...(this.profile.strictToolCalling ? { strict: true } : {})
        }
      }));
    }

    const t0 = Date.now();
    const requestedTools = input.tools?.map((tool) => tool.name) ?? [];
    const requestMeta = {
      providerId: this.id,
      model: this.profile.model,
      baseUrlHost: getBaseUrlHost(this.profile.baseUrl),
      messageCount: input.messages.length,
      requestedTools,
      jsonMode: input.jsonMode === true,
      jsonSchema: input.jsonSchema !== undefined
    };
    log.info(requestMeta, "LLM 请求开始");

    try {
      const completion = await this.client.chat.completions.create(
        body as never,
        input.signal ? { signal: input.signal } : undefined
      );

      const choice = completion.choices[0]?.message;
      const toolCalls = (choice?.tool_calls ?? []).flatMap((tc) => {
        if (tc.type !== "function") return [];
        return [{
          id: tc.id,
          name: tc.function.name as ToolDefinition["name"],
          arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>
        }];
      });

      const tokens = completion.usage
        ? `${completion.usage.prompt_tokens ?? 0}+${completion.usage.completion_tokens ?? 0}`
        : "-";
      const tools = toolCalls.map((tc) => tc.name);
      log.info({
        ...requestMeta,
        durationMs: Date.now() - t0,
        returnedTools: tools,
        inputTokens: completion.usage?.prompt_tokens,
        outputTokens: completion.usage?.completion_tokens,
        requestId: completion._request_id
      }, "LLM 请求完成");
      log.debug({ ...requestMeta, tokens, returnedToolCount: tools.length }, "LLM usage 摘要");

      return {
        content: choice?.content ?? null,
        toolCalls,
        usage: completion.usage
          ? {
              inputTokens: completion.usage.prompt_tokens ?? 0,
              outputTokens: completion.usage.completion_tokens ?? 0
            }
          : undefined
      };
    } catch (error) {
      log.error({
        ...requestMeta,
        durationMs: Date.now() - t0,
        error: summarizeOpenAiError(error)
      }, "LLM 请求失败");
      throw error;
    }
  }
}

function getBaseUrlHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return "invalid-url";
  }
}
