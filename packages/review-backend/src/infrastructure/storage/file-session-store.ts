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
    const createdAt = new Date().toISOString();
    const sessionDir = join(this.rootDir, sessionId);
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, "session.json"),
      JSON.stringify({ sessionId, ...input, status: "running", createdAt }, null, 2)
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
      createdAt?: string;
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
    return sessions
      .filter((session): session is NonNullable<typeof session> => session !== null)
      .sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return b.createdAt.localeCompare(a.createdAt);
        }
        if (a.createdAt) return -1;
        if (b.createdAt) return 1;
        return 0;
      });
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (sessionId.includes("/") || sessionId.includes("\\")) {
      throw new Error("Invalid sessionId");
    }

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

  async exportSessionToMarkdown(sessionId: string): Promise<string> {
    const session = await this.getSession(sessionId);

    const lines: string[] = [];
    lines.push("# 代码审查报告");
    lines.push("");
    lines.push("## 基本信息");
    lines.push(`- **会话 ID**：${sessionId}`);
    lines.push(`- **仓库路径**：${session.repositoryPath}`);
    lines.push(`- **分支对比**：${session.baseRef} → ${session.targetRef}`);
    lines.push(`- **状态**：${session.status}`);
    lines.push("");
    lines.push("## 审查摘要");
    lines.push(`- **变更文件**：${session.summary.changedFilesCount} 个`);
    lines.push(`- **发现问题**：${session.summary.findingsCount} 个`);
    lines.push(`- **高风险**：${session.summary.highSeverityCount} 个`);
    lines.push("");
    lines.push("## 问题列表");

    if (session.findings.length === 0) {
      lines.push("");
      lines.push("暂无问题");
    } else {
      for (const finding of session.findings) {
        lines.push("");
        lines.push(`### ${finding.summary}`);
        lines.push("");
        lines.push(`- **文件**：${finding.file}`);
        if (finding.startLine) {
          lines.push(`- **行号**：${finding.startLine}${finding.endLine ? `-${finding.endLine}` : ""}`);
        }
        lines.push(`- **严重程度**：${finding.severity}`);
        lines.push(`- **类别**：${finding.category}`);
        lines.push(`- **说明**：${finding.explanation}`);
        if (finding.suggestion) {
          lines.push(`- **建议**：${finding.suggestion}`);
        }
      }
    }

    return lines.join("\n");
  }
}
