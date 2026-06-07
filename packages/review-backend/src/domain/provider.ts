import type { ToolCall, ToolDefinition } from "./tool.js";

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export type ChatResponse = {
  content: string | null;
  toolCalls: ToolCall[];
  usage?: { inputTokens: number; outputTokens: number };
};

export interface LlmProvider {
  readonly id: string;
  review(input: {
    prompt: string;
    signal?: AbortSignal;
  }): Promise<{
    content: string;
    usage?: { inputTokens: number; outputTokens: number };
  }>;
  chat?(input: {
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    signal?: AbortSignal;
  }): Promise<ChatResponse>;
}

export type ProviderProfile = {
  id: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};
