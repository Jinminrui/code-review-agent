import { appendFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const emptySummary = {
  changedFilesCount: 0,
  findingsCount: 0,
  highSeverityCount: 0,
  files: []
};

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
    const sessionJson = await readFile(join(sessionDir, "session.json"), "utf8");
    const session = JSON.parse(sessionJson) as {
      sessionId: string;
      status: string;
      repositoryPath: string;
      baseRef: string;
      targetRef: string;
    };

    try {
      const summaryJson = await readFile(join(sessionDir, "summary.json"), "utf8");

      return {
        ...session,
        ...JSON.parse(summaryJson)
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      return {
        ...session,
        summary: emptySummary,
        findings: [],
        diffByFile: {}
      };
    }
  }

  async listSessions() {
    const names = await readdir(this.rootDir);
    const sessions = await Promise.all(names.map((name) => this.getSession(name).catch(() => null)));
    return sessions.filter((session): session is NonNullable<typeof session> => session !== null);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const sessionDir = join(this.rootDir, sessionId);

    // 检查目录是否存在
    try {
      await readFile(join(sessionDir, "session.json"), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Session ${sessionId} not found`);
      }
      throw error;
    }

    // 删除整个会话目录
    await rm(sessionDir, { recursive: true, force: true });
  }
}
