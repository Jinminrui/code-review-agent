import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export class FileSessionStore {
  constructor(private readonly rootDir: string) {}

  async createSession(input: { repositoryPath: string; baseRef: string; targetRef: string }) {
    const sessionId = randomUUID();
    const sessionDir = join(this.rootDir, sessionId);
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, "session.json"),
      JSON.stringify({ sessionId, ...input, status: "running" }, null, 2)
    );
    return { sessionId, sessionDir };
  }
}
