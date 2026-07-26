import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleProvider } from "../src/infrastructure/llm/openai-compatible-provider.js";

const createCompletion = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: createCompletion } }
  }))
}));

describe("OpenAiCompatibleProvider strict structured output", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    createCompletion.mockReset();
  });

  it("将 jsonSchema 转换为 strict json_schema response_format", async () => {
    createCompletion.mockResolvedValue({
      choices: [{ message: { content: '{"ok":true}', tool_calls: [] } }],
      usage: { prompt_tokens: 3, completion_tokens: 2 }
    });

    const provider = new OpenAiCompatibleProvider({
      id: "strict-provider",
      baseUrl: "https://llm.example.test/v1",
      apiKey: "test-key",
      model: "test-model",
      capabilities: { structuredOutput: true, toolCalling: true, usage: true, cancellation: true }
    });

    const result = await provider.chat({
      messages: [{ role: "user", content: "返回结果" }],
      jsonMode: true,
      jsonSchema: { name: "probe", strict: true, schema: { type: "object" } }
    } as never);

    expect(createCompletion).toHaveBeenCalledWith({
      model: "test-model",
      messages: [{ role: "user", content: "返回结果" }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "probe", strict: true, schema: { type: "object" } }
      }
    }, undefined);
    expect(result).toEqual({ content: '{"ok":true}', toolCalls: [], usage: { inputTokens: 3, outputTokens: 2 } });
  });
});
