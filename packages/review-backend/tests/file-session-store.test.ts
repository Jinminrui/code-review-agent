import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileSessionStore } from "../src/infrastructure/storage/file-session-store.js";

describe("FileSessionStore", () => {
  it("returns a running session detail when summary is not written yet", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "review-store-"));
    const store = new FileSessionStore(rootDir);

    const session = await store.createSession({
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature"
    });

    await expect(store.getSession(session.sessionId)).resolves.toMatchObject({
      sessionId: session.sessionId,
      status: "running",
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature",
      summary: {
        changedFilesCount: 0,
        findingsCount: 0,
        highSeverityCount: 0,
        files: []
      },
      findings: [],
      diffByFile: {}
    });
  });

  it("persists and reads back a finished session", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "review-store-"));
    const store = new FileSessionStore(rootDir);

    const session = await store.createSession({
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature"
    });

    await store.appendEvent(session.sessionId, {
      type: "session-started",
      sessionId: session.sessionId
    });

    await store.completeSession(session.sessionId, {
      sessionId: session.sessionId,
      status: "finished",
      summary: {
        changedFilesCount: 1,
        findingsCount: 0,
        highSeverityCount: 0,
        files: []
      },
      findings: [],
      diffByFile: {}
    });

    await expect(store.getSession(session.sessionId)).resolves.toMatchObject({
      sessionId: session.sessionId,
      status: "finished"
    });
    await expect(store.listSessions()).resolves.toHaveLength(1);
  });
});
