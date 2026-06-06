export interface LlmProvider {
    readonly id: string;
    review(input: {
        prompt: string;
        signal?: AbortSignal;
    }): Promise<{
        content: string;
        usage?: {
            inputTokens: number;
            outputTokens: number;
        };
    }>;
}
export type ProviderProfile = {
    id: string;
    baseUrl: string;
    apiKey: string;
    model: string;
};
