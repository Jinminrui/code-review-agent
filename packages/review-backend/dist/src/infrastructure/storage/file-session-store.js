import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
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
        return { sessionId, sessionDir };
    }
}
