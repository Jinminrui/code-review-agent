import { describe, expect, it } from "vitest";
import {
  getMissingProviderCapabilities,
  providerCapabilitiesSchema,
  type ProviderCapabilities,
  type ProviderProfile
} from "../src/domain/provider.js";
import { OpenAiCompatibleProvider } from "../src/infrastructure/llm/openai-compatible-provider.js";

const completeCapabilities: ProviderCapabilities = {
  structuredOutput: true,
  toolCalling: true,
  usage: true,
  cancellation: true,
  contextWindowTokens: 128_000
};

describe("provider capability contract", () => {
  it.each(["structuredOutput", "toolCalling", "usage", "cancellation"] as const)(
    "identifies a missing %s capability declaration",
    (capability) => {
      const incomplete = { ...completeCapabilities } as Partial<ProviderCapabilities>;
      delete incomplete[capability];

      expect(providerCapabilitiesSchema.safeParse(incomplete).success).toBe(false);
      expect(getMissingProviderCapabilities(incomplete)).toContain(capability);
    }
  );

  it.each(["structuredOutput", "toolCalling", "usage", "cancellation"] as const)(
    "identifies an explicitly unsupported %s capability",
    (capability) => {
      const unsupported = {
        ...completeCapabilities,
        [capability]: false
      };

      expect(providerCapabilitiesSchema.parse(unsupported)[capability]).toBe(false);
      expect(getMissingProviderCapabilities(unsupported)).toContain(capability);
    }
  );

  it("accepts a complete capability declaration", () => {
    expect(providerCapabilitiesSchema.parse(completeCapabilities)).toEqual(completeCapabilities);
    expect(getMissingProviderCapabilities(completeCapabilities)).toEqual([]);
  });
});

describe("OpenAI-compatible provider capabilities", () => {
  const profile = {
    id: "openai-compatible",
    baseUrl: "https://llm.example.test/v1",
    apiKey: "test-key",
    model: "test-model"
  };

  it("uses conservative capabilities when none were confirmed", () => {
    const provider = new OpenAiCompatibleProvider(profile);

    expect(provider.capabilities).toEqual({
      structuredOutput: false,
      toolCalling: false,
      usage: false,
      cancellation: false
    });
  });

  it("propagates an explicitly configured capability declaration", () => {
    const provider = new OpenAiCompatibleProvider({
      ...profile,
      capabilities: completeCapabilities
    });

    expect(provider.capabilities).toEqual(completeCapabilities);
  });

  it("rejects an invalid configured capability declaration", () => {
    const invalidProfile = {
      ...profile,
      capabilities: {
        ...completeCapabilities,
        usage: "yes"
      }
    } as unknown as ProviderProfile;

    expect(() => new OpenAiCompatibleProvider(invalidProfile)).toThrow();
  });
});
