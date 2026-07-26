import { z } from "zod";
import type { ToolCall, ToolDefinition } from "./tool.js";

const requiredProviderCapabilityNames = [
  "structuredOutput",
  "toolCalling",
  "usage",
  "cancellation"
] as const;

export const providerCapabilitiesSchema = z.object({
  structuredOutput: z.boolean(),
  toolCalling: z.boolean(),
  usage: z.boolean(),
  cancellation: z.boolean(),
  contextWindowTokens: z.number().int().positive().optional()
});

export type ProviderCapabilities = z.infer<typeof providerCapabilitiesSchema>;
export type ProviderCapabilityName = (typeof requiredProviderCapabilityNames)[number];

export function getMissingProviderCapabilities(
  capabilities: Partial<ProviderCapabilities>
): ProviderCapabilityName[] {
  // 只有显式 true 表示 provider 具备能力；false 和未声明都进入降级判断。
  return requiredProviderCapabilityNames.filter((capability) => capabilities[capability] !== true);
}

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
  readonly capabilities: ProviderCapabilities;
  chat(input: {
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    jsonMode?: boolean;
    signal?: AbortSignal;
  }): Promise<ChatResponse>;
}

export type ProviderProfile = {
  id: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  contextWindowTokens?: number;
  capabilities?: ProviderCapabilities;
};
