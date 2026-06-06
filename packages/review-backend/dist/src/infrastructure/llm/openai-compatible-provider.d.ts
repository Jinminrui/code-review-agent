import type { LlmProvider, ProviderProfile } from "../../domain/provider.js";
export declare class OpenAiCompatibleProvider implements LlmProvider {
    private readonly profile;
    readonly id: string;
    constructor(profile: ProviderProfile);
    review(input: {
        prompt: string;
        signal?: AbortSignal;
    }): Promise<{
        content: string;
        usage: {
            inputTokens: number;
            outputTokens: number;
        } | undefined;
    }>;
}
