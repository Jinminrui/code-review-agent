export * from "./application/stream-review-session.js";
export * from "./application/build-review-summary.js";
export * from "./application/start-review-session.js";
export * from "./contracts/ipc.js";
export * from "./domain/provider.js";
export * from "./domain/review-finding.js";
export * from "./domain/review-session.js";
export * from "./domain/review-unit.js";
export * from "./infrastructure/context/context-collector.js";
export * from "./infrastructure/git/git-client.js";
export * from "./infrastructure/git/parse-unified-diff.js";
export * from "./infrastructure/llm/normalize-provider-output.js";
export * from "./infrastructure/llm/openai-compatible-provider.js";
export * from "./infrastructure/logging/logger.js";
export * from "./infrastructure/planner/review-unit-planner.js";
export * from "./infrastructure/storage/file-session-store.js";
export * from "./infrastructure/storage/paths.js";
export const backendVersion = "0.1.0";
if (process.env.NODE_ENV !== "test") {
    console.log(`[review-backend] ${backendVersion}`);
}
