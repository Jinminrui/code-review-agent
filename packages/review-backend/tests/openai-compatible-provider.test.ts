import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleProvider, summarizeOpenAiError } from "../src/infrastructure/llm/openai-compatible-provider.js";

const createCompletion = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: createCompletion } }
  }))
}));

describe("OpenAiCompatibleProvider tool calling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    createCompletion.mockReset();
  });

  it("提取 provider 错误摘要而不记录完整错误对象", () => {
    expect(summarizeOpenAiError({ name: "APIError", message: "401 unauthorized", status: 401, code: "invalid_api_key", request_id: "req-1" })).toEqual({
      name: "APIError",
      message: "401 unauthorized",
      status: 401,
      code: "invalid_api_key",
      requestId: "req-1"
    });
  });

  it("将结构化提交工具转换为 OpenAI-compatible tools", async () => {
    createCompletion.mockResolvedValue({
      choices: [{ message: { content: '{"ok":true}', tool_calls: [] } }],
      usage: { prompt_tokens: 3, completion_tokens: 2 }
    });

    const provider = new OpenAiCompatibleProvider({
      id: "strict-provider",
      baseUrl: "https://llm.example.test/v1",
      apiKey: "test-key",
      model: "test-model",
      strictToolCalling: true,
      capabilities: { structuredOutput: false, toolCalling: true, usage: true, cancellation: true }
    });

    const result = await provider.chat({
      messages: [{ role: "user", content: "返回结果" }],
      tools: [{ name: "submit_review_plan", description: "提交计划", parameters: { type: "object" } }]
    } as never);

    expect(createCompletion).toHaveBeenCalledWith({
      model: "test-model",
      messages: [{ role: "user", content: "返回结果" }],
      tools: [{ type: "function", function: { name: "submit_review_plan", description: "提交计划", parameters: { type: "object" }, strict: true } }]
    }, undefined);
    expect(result).toEqual({ content: '{"ok":true}', toolCalls: [], usage: { inputTokens: 3, outputTokens: 2 } });
  });

  it("解析结构化提交工具的 arguments", async () => {
    createCompletion.mockResolvedValue({
      choices: [{ message: { content: null, tool_calls: [{ id: "call-1", type: "function", function: { name: "submit_review_plan", arguments: '{"version":1}' } }] } }]
    });

    const provider = new OpenAiCompatibleProvider({
      id: "tool-provider",
      baseUrl: "https://llm.example.test/v1",
      apiKey: "test-key",
      model: "test-model",
      capabilities: { structuredOutput: false, toolCalling: true, usage: true, cancellation: true }
    });

    const result = await provider.chat({ messages: [{ role: "user", content: "返回结果" }], tools: [{ name: "submit_review_plan", description: "提交计划", parameters: { type: "object" } }] } as never);

    expect(result.toolCalls[0]).toMatchObject({ id: "call-1", name: "submit_review_plan", arguments: { version: 1 } });
  });

  it("将 jsonMode 转换为 json_object response_format", async () => {
    createCompletion.mockResolvedValue({
      choices: [{ message: { content: '{\"version\":1}', tool_calls: [] } }]
    });

    const provider = new OpenAiCompatibleProvider({
      id: "json-provider",
      baseUrl: "https://llm.example.test/v1",
      apiKey: "test-key",
      model: "test-model",
      capabilities: { structuredOutput: false, toolCalling: true, usage: true, cancellation: true }
    });

    await provider.chat({ messages: [{ role: "user", content: "返回 JSON" }], jsonMode: true });

    expect(createCompletion).toHaveBeenCalledWith({
      model: "test-model",
      messages: [{ role: "user", content: "返回 JSON" }],
      response_format: { type: "json_object" }
    }, undefined);
  });
});
