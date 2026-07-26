import { describe, expect, it } from "vitest";
import { reviewSessionEventSchema, reviewSessionInputSchema } from "./index.js";

describe("review-contracts", () => {
  it("校验 IPC 输入和版本化阶段事件", () => {
    expect(reviewSessionInputSchema.parse({ repositoryPath: "/repo", baseRef: "main", targetRef: "feature" }).contextBudgetTokens).toBe(12000);
    expect(reviewSessionEventSchema.safeParse({
      type: "phase-transitioned",
      sessionId: "s-1",
      schemaVersion: 1,
      runtimeVersion: "1.0.0",
      previousPhase: "session-created",
      phase: "pre-analysis-completed"
    }).success).toBe(true);
  });
});
