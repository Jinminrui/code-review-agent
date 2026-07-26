import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSessionStore } from "../src/infrastructure/storage/file-session-store.js";

describe("review session recovery", () => {
  it("persists versions, returns the last boundary, and creates a rerun source", async () => {
    const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "review-recovery-")));
    const session = await store.createSession({ repositoryPath: "/repo", baseRef: "main", targetRef: "feature", runtimeVersion: "1.0.0", planVersion: 1 });
    await store.appendEvent(session.sessionId, { type: "phase-transitioned", sessionId: session.sessionId, schemaVersion: 1, runtimeVersion: "1.0.0", previousPhase: "session-created", phase: "pre-analysis-completed" });
    expect(await store.getRecoveryPoint(session.sessionId)).toMatchObject({ phase: "pre-analysis-completed", resumable: true });
    const rerun = await store.createRerunSession(session.sessionId);
    expect(rerun.sourceSessionId).toBe(session.sessionId);
    expect(JSON.parse(await readFile(join(session.sessionDir, "session.json"), "utf8"))).toMatchObject({ runtimeVersion: "1.0.0", schemaVersion: 1, planVersion: 1 });
  });

  it.each(["react-evidence-collecting", "reflection-validating", "evidence-backfill"] as const)(
    "moves an in-flight unit phase %s back to unit-plan-started",
    async (phase) => {
      const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "review-recovery-")));
      const session = await store.createSession({ repositoryPath: "/repo", baseRef: "main", targetRef: "feature" });
      await store.appendEvent(session.sessionId, { type: "phase-transitioned", sessionId: session.sessionId, schemaVersion: 1, runtimeVersion: "1.0.0", previousPhase: "session-created", phase: "pre-analysis-completed" });
      await store.appendEvent(session.sessionId, { type: "phase-transitioned", sessionId: session.sessionId, schemaVersion: 1, runtimeVersion: "1.0.0", previousPhase: "pre-analysis-completed", phase: "global-plan-completed" });
      const path: Array<readonly [string, string]> = phase === "react-evidence-collecting"
        ? [["global-plan-completed", "unit-plan-started"], ["unit-plan-started", phase]]
        : phase === "reflection-validating"
          ? [["global-plan-completed", "unit-plan-started"], ["unit-plan-started", "react-evidence-collecting"], ["react-evidence-collecting", phase]]
          : [["global-plan-completed", "unit-plan-started"], ["unit-plan-started", "react-evidence-collecting"], ["react-evidence-collecting", "reflection-validating"], ["reflection-validating", phase]];
      for (const [previousPhase, currentPhase] of path) await store.appendEvent(session.sessionId, { type: "phase-transitioned", sessionId: session.sessionId, schemaVersion: 1, runtimeVersion: "1.0.0", previousPhase: previousPhase as any, phase: currentPhase as any, unitId: "unit-a" });
      await expect(store.getRecoveryPoint(session.sessionId)).resolves.toMatchObject({ phase, resumePhase: "unit-plan-started", unitId: "unit-a", resumable: true });
    }
  );

  it("does not mark global reflection as completed while its request is in flight", async () => {
    const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "review-recovery-")));
    const session = await store.createSession({ repositoryPath: "/repo", baseRef: "main", targetRef: "feature" });
    for (const [previousPhase, phase] of [["session-created", "pre-analysis-completed"], ["pre-analysis-completed", "global-plan-completed"], ["global-plan-completed", "unit-plan-started"], ["unit-plan-started", "react-evidence-collecting"], ["react-evidence-collecting", "reflection-validating"], ["reflection-validating", "unit-completed"]] as const) {
      await store.appendEvent(session.sessionId, { type: "phase-transitioned", sessionId: session.sessionId, schemaVersion: 1, runtimeVersion: "1.0.0", previousPhase, phase, ...(phase === "unit-plan-started" || phase === "react-evidence-collecting" || phase === "reflection-validating" || phase === "unit-completed" ? { unitId: "unit-a" } : {}) });
    }
    await store.appendEvent(session.sessionId, { type: "phase-transitioned", sessionId: session.sessionId, schemaVersion: 1, runtimeVersion: "1.0.0", previousPhase: "unit-completed", phase: "global-reflection-validating" });
    await expect(store.getRecoveryPoint(session.sessionId)).resolves.toMatchObject({ phase: "global-reflection-validating", resumable: true });
    await expect(store.getRecoveryPoint(session.sessionId)).resolves.not.toMatchObject({ phase: "global-reflection-completed" });
  });

  it("rejects traversal session ids at every recovery boundary", async () => {
    const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "review-recovery-")));
    await expect(store.readEvents("../events")).rejects.toThrow("Invalid sessionId");
    await expect(store.getRecoveryPoint("foo/bar")).rejects.toThrow("Invalid sessionId");
    await expect(store.createRerunSession("foo\\bar")).rejects.toThrow("Invalid sessionId");
  });

  it.each(["", ".", "..", "bad/id", "bad\\id"])("rejects invalid session id %j for all file operations", async (sessionId) => {
    const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "review-recovery-")));
    const event = { type: "session-started", sessionId: "s_1" } as const;
    await expect(store.appendEvent(sessionId, event)).rejects.toThrow("Invalid sessionId");
    await expect(store.completeSession(sessionId, {})).rejects.toThrow("Invalid sessionId");
    await expect(store.getSession(sessionId)).rejects.toThrow("Invalid sessionId");
    await expect(store.exportSessionToMarkdown(sessionId)).rejects.toThrow("Invalid sessionId");
    await expect(store.readEvents(sessionId)).rejects.toThrow("Invalid sessionId");
    await expect(store.getRecoveryPoint(sessionId)).rejects.toThrow("Invalid sessionId");
    await expect(store.createRerunSession(sessionId)).rejects.toThrow("Invalid sessionId");
    await expect(store.deleteSession(sessionId)).rejects.toThrow("Invalid sessionId");
  });

  it("fails closed when persisted events belong to another session or contain an invalid phase sequence", async () => {
    const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "review-recovery-")));
    const session = await store.createSession({ repositoryPath: "/repo", baseRef: "main", targetRef: "feature" });
    await expect(store.appendEvent(session.sessionId, { type: "phase-transitioned", sessionId: "other", schemaVersion: 1, runtimeVersion: "1.0.0", previousPhase: "session-created", phase: "pre-analysis-completed" })).rejects.toThrow();
  });

  it("fails closed when a persisted unit result crosses unit boundaries", async () => {
    const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "review-recovery-")));
    const session = await store.createSession({ repositoryPath: "/repo", baseRef: "main", targetRef: "feature" });
    await store.appendEvent(session.sessionId, { type: "phase-transitioned", sessionId: session.sessionId, schemaVersion: 1, runtimeVersion: "1.0.0", previousPhase: "session-created", phase: "pre-analysis-completed" });
    await store.appendEvent(session.sessionId, { type: "phase-transitioned", sessionId: session.sessionId, schemaVersion: 1, runtimeVersion: "1.0.0", previousPhase: "pre-analysis-completed", phase: "global-plan-completed" });
    await store.appendEvent(session.sessionId, { type: "phase-transitioned", sessionId: session.sessionId, schemaVersion: 1, runtimeVersion: "1.0.0", previousPhase: "global-plan-completed", phase: "unit-plan-started", unitId: "unit-a" });
    await store.appendEvent(session.sessionId, { type: "phase-transitioned", sessionId: session.sessionId, schemaVersion: 1, runtimeVersion: "1.0.0", previousPhase: "unit-plan-started", phase: "react-evidence-collecting", unitId: "unit-a" });
    await store.appendEvent(session.sessionId, { type: "phase-transitioned", sessionId: session.sessionId, schemaVersion: 1, runtimeVersion: "1.0.0", previousPhase: "react-evidence-collecting", phase: "reflection-validating", unitId: "unit-a" });
    await expect(store.appendEvent(session.sessionId, { type: "phase-transitioned", sessionId: session.sessionId, schemaVersion: 1, runtimeVersion: "1.0.0", previousPhase: "reflection-validating", phase: "unit-completed", unitId: "unit-a", unitResult: { unitId: "unit-b", file: "src/b.ts", findings: [], reflectionResult: { schemaVersion: 1, unitId: "unit-b", candidates: [] }, evidenceSummary: { schemaVersion: 1, unitId: "unit-b", completeness: "complete", items: [] } } })).rejects.toThrow("unitResult.unitId");
  });

  it.each([
    ["session-finished", "global-reflection-completed", { totalFindings: 0, status: "finished" }],
    ["session-cancelled", "session-cancelled", { totalFindings: 0 }]
  ] as const)("requires legacy %s to match the terminal phase", async (eventType, phase, payload) => {
    const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "review-recovery-")));
    const session = await store.createSession({ repositoryPath: "/repo", baseRef: "main", targetRef: "feature" });
    await store.appendEvent(session.sessionId, { type: "phase-transitioned", sessionId: session.sessionId, schemaVersion: 1, runtimeVersion: "1.0.0", previousPhase: "session-created", phase: "pre-analysis-completed" });
    await expect(store.appendEvent(session.sessionId, { type: eventType as "session-finished", sessionId: session.sessionId, ...(payload as object) })).rejects.toThrow();
  });

  it("rejects a second terminal event and any event after a terminal event", async () => {
    const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "review-recovery-")));
    const session = await store.createSession({ repositoryPath: "/repo", baseRef: "main", targetRef: "feature" });
    await store.appendEvent(session.sessionId, { type: "phase-transitioned", sessionId: session.sessionId, schemaVersion: 1, runtimeVersion: "1.0.0", previousPhase: "session-created", phase: "session-cancelled" });
    await store.appendEvent(session.sessionId, { type: "session-cancelled", sessionId: session.sessionId, totalFindings: 0 });
    await expect(store.getRecoveryPoint(session.sessionId)).resolves.toMatchObject({ resumable: false });
    await expect(store.appendEvent(session.sessionId, { type: "session-cancelled", sessionId: session.sessionId, totalFindings: 0 })).rejects.toThrow();
  });

  it.each([
    ["session-finished", { totalFindings: 0, status: "finished" as const }],
    ["session-cancelled", { totalFindings: 0 }]
  ] as const)("accepts a complete legacy %s sequence without phase events", async (terminalType, terminalPayload) => {
    const store = new FileSessionStore(await mkdtemp(join(tmpdir(), "review-recovery-")));
    const session = await store.createSession({ repositoryPath: "/repo", baseRef: "main", targetRef: "feature" });
    await store.appendEvent(session.sessionId, { type: "session-started", sessionId: session.sessionId });
    await store.appendEvent(session.sessionId, {
      type: "unit-completed",
      sessionId: session.sessionId,
      unitId: "unit-a",
      findingsCount: 0,
      findings: [],
      diffByFile: {}
    });
    await store.appendEvent(session.sessionId, { type: terminalType, sessionId: session.sessionId, ...terminalPayload });
    await expect(store.readEvents(session.sessionId)).resolves.toHaveLength(3);
    await expect(store.appendEvent(session.sessionId, { type: "session-started", sessionId: session.sessionId })).rejects.toThrow();
  });
});
