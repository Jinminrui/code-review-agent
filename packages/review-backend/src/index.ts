// Application layer
export * from "./application/stream-review-session.js";
export * from "./application/build-review-summary.js";
export * from "./application/start-review-session.js";
export * from "./application/get-review-session.js";
export * from "./application/list-review-sessions.js";

// Contracts
export * from "./contracts/ipc.js";

// Domain types
export * from "./domain/provider.js";
export * from "./domain/review-finding.js";
export * from "./domain/review-session.js";

export * from "./domain/tool.js";
export * from "./domain/review-plan.js";
export * from "./domain/review-rules.js";

export const backendVersion = "0.1.0";

if (process.env.NODE_ENV !== "test") {
  console.log(`[review-backend] ${backendVersion}`);
}
