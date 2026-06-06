import type { LlmProvider, ProviderProfile } from "../../domain/provider.js";

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly id: string;

  constructor(private readonly profile: ProviderProfile) {
    this.id = profile.id;
  }

  async review(_input: { prompt: string; signal?: AbortSignal }) {
    return {
      content: JSON.stringify({
        provider: this.profile.model,
        findings: []
      })
    };
  }
}
