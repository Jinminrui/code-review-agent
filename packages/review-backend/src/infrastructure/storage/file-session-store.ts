import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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
    await writeFile(join(sessionDir, "events.jsonl"), "");
    return { sessionId, sessionDir };
  }

  async appendEvent(sessionId: string, event: unknown) {
    const sessionDir = join(this.rootDir, sessionId);
    await appendFile(join(sessionDir, "events.jsonl"), `${JSON.stringify(event)}\n`);
  }

  async completeSession(sessionId: string, summary: unknown) {
    const sessionDir = join(this.rootDir, sessionId);
    await writeFile(join(sessionDir, "summary.json"), JSON.stringify(summary, null, 2));
  }

  async getSession(sessionId: string) {
    const sessionDir = join(this.rootDir, sessionId);
    const [sessionJson, summaryJson] = await Promise.all([
      readFile(join(sessionDir, "session.json"), "utf8"),
      readFile(join(sessionDir, "summary.json"), "utf8")
    ]);

    return {
      ...JSON.parse(sessionJson),
      ...JSON.parse(summaryJson)
    };
  }

  async listSessions() {
    const names = await readdir(this.rootDir);
    const sessions = await Promise.all(names.map((name) => this.getSession(name).catch(() => null)));
    return sessions.filter((session): session is NonNullable<typeof session> => session !== null);
  }
}
