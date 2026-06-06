export class OpenAiCompatibleProvider {
    profile;
    id;
    constructor(profile) {
        this.profile = profile;
        this.id = profile.id;
    }
    async review(input) {
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
            throw new Error(`OpenAI-compatible provider request failed: ${response.status}`);
        }
        const payload = (await response.json());
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
}
