import type {
  ChatMessage,
  ChatResponse,
  LlmProvider,
  ProviderProfile
} from "../../domain/provider.js";
import type { ToolDefinition } from "../../domain/tool.js";
import { logger } from "../logging/logger.js";

const log = logger.child({ component: "llm" });

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly id: string;

  constructor(private readonly profile: ProviderProfile) {
    this.id = profile.id;
  }

  async review(input: { prompt: string; signal?: AbortSignal }) {
    const t0 = Date.now();
    const response = await fetch(`${this.profile.baseUrl}/chat/completions`, {
      method: "POST",
      signal: input.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.profile.apiKey}`
      },
      body: JSON.stringify({
        model: this.profile.model,
        messages: [{ role: "user", content: input.prompt }],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      log.error(`LLM 请求失败: HTTP ${response.status}, ${Date.now() - t0}ms`);
      throw new Error(`OpenAI-compatible provider request failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const tokens = payload.usage ? `${payload.usage.prompt_tokens ?? 0}+${payload.usage.completion_tokens ?? 0}` : "-";
    log.info(`LLM 调用完成: ${Date.now() - t0}ms, tokens=${tokens}`);

    return {
      content: payload.choices?.[0]?.message?.content ?? "{\"findings\":[]}",
      usage: payload.usage
        ? {
            inputTokens: payload.usage.prompt_tokens ?? 0,
            outputTokens: payload.usage.completion_tokens ?? 0
          }
        : undefined
    };
  }

  async chat(input: {
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    signal?: AbortSignal;
  }): Promise<ChatResponse> {
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
      log.error(`LLM chat 请求失败: HTTP ${response.status}, ${Date.now() - t0}ms`);
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
    log.info(`LLM chat 完成: ${Date.now() - t0}ms, tools=[${tools}], tokens=${tokens}`);

    return {
      content: choice?.content ?? null,
      toolCalls,
      usage: payload.usage
        ? { inputTokens: payload.usage.prompt_tokens ?? 0, outputTokens: payload.usage.completion_tokens ?? 0 }
        : undefined
    };
  }
}
