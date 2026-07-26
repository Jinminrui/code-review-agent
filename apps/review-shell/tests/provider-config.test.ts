import { describe, expect, it } from "vitest";
import { resolveOpenAiProviderCapabilities, resolveOpenAiProviderConfig } from "../src/provider-config.js";

describe("resolveOpenAiProviderConfig", () => {
  it("从环境变量读取配置并默认使用 MiMo 模型", () => {
    expect(resolveOpenAiProviderConfig({ OPENAI_API_KEY: " test-key " })).toEqual({
      baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
      apiKey: "test-key",
      model: "mimo-v2.5-pro"
    });
  });

  it("缺少 API key 时拒绝启动 provider", () => {
    expect(() => resolveOpenAiProviderConfig({})).toThrow("OPENAI_API_KEY is required");
  });
});

describe("resolveOpenAiProviderCapabilities", () => {
  it("默认显式启用兼容 endpoint 的能力", () => {
    expect(resolveOpenAiProviderCapabilities({})).toEqual({
      structuredOutput: true,
      toolCalling: true,
      usage: true,
      cancellation: true
    });
  });

  it("允许通过环境变量关闭不支持的能力", () => {
    expect(resolveOpenAiProviderCapabilities({
      OPENAI_STRUCTURED_OUTPUT: "false",
      OPENAI_TOOL_CALLING: "FALSE",
      OPENAI_USAGE: "false",
      OPENAI_CANCELLATION: "false"
    })).toEqual({
      structuredOutput: false,
      toolCalling: false,
      usage: false,
      cancellation: false
    });
  });
});
