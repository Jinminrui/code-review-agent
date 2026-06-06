export class OpenAiCompatibleProvider {
    profile;
    id;
    constructor(profile) {
        this.profile = profile;
        this.id = profile.id;
    }
    async review(_input) {
        return {
            content: JSON.stringify({
                provider: this.profile.model,
                findings: []
            })
        };
    }
}
