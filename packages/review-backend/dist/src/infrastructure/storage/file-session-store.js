import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
const emptySummary = {
    changedFilesCount: 0,
    findingsCount: 0,
    highSeverityCount: 0,
    files: []
};
export class FileSessionStore {
    rootDir;
    constructor(rootDir) {
        this.rootDir = rootDir;
    }
    async createSession(input) {
        const sessionId = randomUUID();
        const sessionDir = join(this.rootDir, sessionId);
        await mkdir(sessionDir, { recursive: true });
        await writeFile(join(sessionDir, "session.json"), JSON.stringify({ sessionId, ...input, status: "running" }, null, 2));
        await writeFile(join(sessionDir, "events.jsonl"), "");
        return { sessionId, sessionDir };
    }
    async appendEvent(sessionId, event) {
        const sessionDir = join(this.rootDir, sessionId);
        await appendFile(join(sessionDir, "events.jsonl"), `${JSON.stringify(event)}\n`);
    }
    async completeSession(sessionId, summary) {
        const sessionDir = join(this.rootDir, sessionId);
        await writeFile(join(sessionDir, "summary.json"), JSON.stringify(summary, null, 2));
    }
    async getSession(sessionId) {
        const sessionDir = join(this.rootDir, sessionId);
        const sessionJson = await readFile(join(sessionDir, "session.json"), "utf8");
        const session = JSON.parse(sessionJson);
        try {
            const summaryJson = await readFile(join(sessionDir, "summary.json"), "utf8");
            return {
                ...session,
                ...JSON.parse(summaryJson)
            };
        }
        catch (error) {
            if (error.code !== "ENOENT") {
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
        return sessions.filter((session) => session !== null);
    }
}
