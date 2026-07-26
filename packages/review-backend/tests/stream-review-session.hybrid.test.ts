import { describe, expect, it, vi } from "vitest";
import { streamReviewSession } from "../src/application/stream-review-session.js";

describe("streamReviewSession hybrid mode", () => {
  it("uses the hybrid runtime when explicitly selected and appends before yielding", async () => {
    const order: string[] = [];
    const store = { createSession: vi.fn().mockResolvedValue({ sessionId: "s_hybrid" }), appendEvent: vi.fn(async (_id, event) => { order.push(`append:${event.type}`); }), completeSession: vi.fn() };
    const events = [];
    for await (const event of streamReviewSession({ input: { repositoryPath: "/repo", baseRef: "main", targetRef: "feature", contextBudgetTokens: 1000 }, mode: "hybrid", dependencies: {
      provider: { id: "fake", capabilities: { structuredOutput: true, toolCalling: true, usage: true, cancellation: true }, chat: vi.fn() },
      gitClient: { readDiff: vi.fn().mockResolvedValue([]), readWorkspaceDiff: vi.fn().mockResolvedValue([]), readFileAtRef: vi.fn(), lsFiles: vi.fn(), grep: vi.fn() }, sessionStore: store
    } })) { events.push(event); expect(order.at(-1)).toBe(`append:${event.type}`); }
    expect(events.some((event) => event.type === "session-finished")).toBe(true);
  });

  it("accepts resumeSessionId without creating a new session", async () => {
    const appendEvent = vi.fn();
    const store = {
      createSession: vi.fn(),
      appendEvent,
      completeSession: vi.fn(),
      getRecoveryPoint: vi.fn().mockResolvedValue({ phase: "pre-analysis-completed", resumePhase: "pre-analysis-completed", resumable: true }),
      readEvents: vi.fn().mockResolvedValue([{ type: "phase-transitioned", sessionId: "s-existing", schemaVersion: 1, runtimeVersion: "1.0.0", previousPhase: "session-created", phase: "pre-analysis-completed" }])
    };
    const events = [];
    for await (const event of streamReviewSession({ resumeSessionId: "s-existing", mode: "hybrid", input: { repositoryPath: "/repo", baseRef: "main", targetRef: "feature", contextBudgetTokens: 1000 }, dependencies: {
      provider: { id: "fake", capabilities: { structuredOutput: true, toolCalling: true, usage: true, cancellation: true }, chat: vi.fn() },
      gitClient: { readDiff: vi.fn().mockResolvedValue([]), readWorkspaceDiff: vi.fn().mockResolvedValue([]), readFileAtRef: vi.fn(), lsFiles: vi.fn(), grep: vi.fn() }, sessionStore: store
    } })) events.push(event);
    expect(store.createSession).not.toHaveBeenCalled();
    expect(events.some((event) => event.sessionId === "s-existing")).toBe(true);
  });

  it("rejects a non-resumable session before constructing the orchestrator", async () => {
    const store = { createSession: vi.fn(), appendEvent: vi.fn(), completeSession: vi.fn(), getRecoveryPoint: vi.fn().mockResolvedValue({ phase: "session-finished", resumePhase: "session-finished", resumable: false }), readEvents: vi.fn().mockResolvedValue([]) };
    await expect(async () => {
      for await (const _event of streamReviewSession({ resumeSessionId: "s-finished", mode: "hybrid", input: { repositoryPath: "/repo", baseRef: "main", targetRef: "feature", contextBudgetTokens: 1000 }, dependencies: {
        provider: { id: "fake", capabilities: { structuredOutput: true, toolCalling: true, usage: true, cancellation: true }, chat: vi.fn() },
        gitClient: { readDiff: vi.fn(), readWorkspaceDiff: vi.fn(), readFileAtRef: vi.fn(), lsFiles: vi.fn(), grep: vi.fn() }, sessionStore: store
      } })) { /* consume */ }
    }).rejects.toThrow("not resumable");
    expect(store.createSession).not.toHaveBeenCalled();
  });
});
