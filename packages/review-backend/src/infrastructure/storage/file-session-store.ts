/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { appendFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { reviewSessionEventSchema, type ReviewSessionEvent } from "../../domain/review-session.js";
import { REVIEW_SCHEMA_VERSION, type ReviewRuntimePhase } from "../../domain/review-runtime.js";

const emptySummary = {
  changedFilesCount: 0,
  findingsCount: 0,
  highSeverityCount: 0,
  files: []
};

export class FileSessionStore {
  constructor(private readonly rootDir: string) {}

  async createSession(input: {
    repositoryPath: string;
    baseRef: string;
    targetRef: string;
    runtimeVersion?: string;
    schemaVersion?: number;
    planVersion?: number;
    sourceSessionId?: string;
  }) {
    // 一个会话一个目录，事件采用 JSONL 追加写入，适合流式审查过程中的增量落盘。
    const sessionId = randomUUID();
    const createdAt = new Date().toISOString();
    const sessionDir = join(this.rootDir, sessionId);
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, "session.json"),
      JSON.stringify({
        sessionId,
        ...input,
        runtimeVersion: input.runtimeVersion ?? "legacy",
        schemaVersion: input.schemaVersion ?? REVIEW_SCHEMA_VERSION,
        planVersion: input.planVersion ?? 0,
        status: "running",
        createdAt
      }, null, 2)
    );
    await writeFile(join(sessionDir, "events.jsonl"), "");
    return { sessionId, sessionDir };
  }

  async readEvents(sessionId: string): Promise<ReviewSessionEvent[]> {
    // 读取前校验 sessionId，既保证路径安全，也避免把任意目录当作 session 解析。
    assertValidSessionId(sessionId);
    const sessionDir = join(this.rootDir, sessionId);
    const content = await readFile(join(sessionDir, "events.jsonl"), "utf8");
    const events = content.split("\n").filter(Boolean).map((line) => parseReviewSessionEvent(JSON.parse(line)));
    validateReviewSessionEventSequence(events, sessionId);
    return events;
  }

  async getRecoveryPoint(sessionId: string): Promise<{
    phase: ReviewRuntimePhase | "session-started";
    resumePhase: ReviewRuntimePhase | "session-started";
    unitId?: string;
    resumable: boolean;
  }> {
    // 执行中的 ReAct/Reflection 请求不可精确恢复，只能回退到安全的 unit 边界。
    assertValidSessionId(sessionId);
    const events = await this.readEvents(sessionId);
    const phaseEvent = [...events].reverse().find((event) => event.type === "phase-transitioned");
    if (phaseEvent?.type === "phase-transitioned") {
      const resumePhase = [
        "react-evidence-collecting",
        "reflection-validating",
        "evidence-backfill"
      ].includes(phaseEvent.phase) && phaseEvent.unitId
        ? "unit-plan-started"
        : phaseEvent.phase === "unit-completed" || phaseEvent.phase === "unit-failed"
        ? "unit-plan-started"
        : phaseEvent.phase;
      return { phase: phaseEvent.phase, resumePhase, ...(phaseEvent.unitId ? { unitId: phaseEvent.unitId } : {}), resumable: !["session-finished", "session-cancelled"].includes(phaseEvent.phase) };
    }
    return { phase: "session-started", resumePhase: "session-started", resumable: true };
  }

  async createRerunSession(sessionId: string) {
    assertValidSessionId(sessionId);
    const source = await this.getSession(sessionId);
    const created = await this.createSession({
      repositoryPath: source.repositoryPath,
      baseRef: source.baseRef,
      targetRef: source.targetRef,
      runtimeVersion: source.runtimeVersion,
      schemaVersion: source.schemaVersion,
      planVersion: source.planVersion,
      sourceSessionId: sessionId
    });
    return { ...created, sourceSessionId: sessionId };
  }

  async appendEvent(sessionId: string, event: unknown) {
    // JSONL 不是任意 JSON 容器：先完成 schema 校验和旧事件迁移，再追加日志。
    assertValidSessionId(sessionId);
    const parsedEvent = parseReviewSessionEvent(event);
    if (parsedEvent.sessionId !== sessionId) throw new Error("Event sessionId does not match sessionId");
    const existingEvents = await this.readEvents(sessionId);
    validateReviewSessionEventSequence([...existingEvents, parsedEvent], sessionId);
    const sessionDir = join(this.rootDir, sessionId);
    await appendFile(join(sessionDir, "events.jsonl"), `${JSON.stringify(parsedEvent)}\n`);
  }

  async completeSession(sessionId: string, summary: unknown) {
    assertValidSessionId(sessionId);
    const sessionDir = join(this.rootDir, sessionId);
    await writeFile(join(sessionDir, "summary.json"), JSON.stringify(summary, null, 2));

    const sessionPath = join(sessionDir, "session.json");
    const session = JSON.parse(await readFile(sessionPath, "utf8")) as { status: string } & Record<string, unknown>;
    const status = (summary as { status?: unknown }).status;
    if (status === "finished" || status === "partial" || status === "cancelled") {
      await writeFile(sessionPath, JSON.stringify({ ...session, status }, null, 2));
    }
  }

  async getSession(sessionId: string) {
    assertValidSessionId(sessionId);
    const sessionDir = join(this.rootDir, sessionId);
    const sessionJson = await readFile(join(sessionDir, "session.json"), "utf8");
    const session = JSON.parse(sessionJson) as {
      sessionId: string;
      status: string;
      repositoryPath: string;
      baseRef: string;
      targetRef: string;
      createdAt?: string;
      runtimeVersion?: string;
      schemaVersion?: number;
      planVersion?: number;
      sourceSessionId?: string;
    };

    try {
      const summaryJson = await readFile(join(sessionDir, "summary.json"), "utf8");

      return {
        ...session,
        ...JSON.parse(summaryJson)
      };
    } catch (error) {
      // 审查进行中可能尚未生成 summary，此时返回可渲染的空结果而不是让历史页崩溃。
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
    assertValidSessionId(sessionId);

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
    assertValidSessionId(sessionId);
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

function assertValidSessionId(sessionId: string): void {
  if (typeof sessionId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(sessionId) || sessionId === "." || sessionId === "..") {
    throw new Error("Invalid sessionId");
  }
}

export function parseReviewSessionEvent(value: unknown): ReviewSessionEvent {
  const parsed = reviewSessionEventSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return migrateReviewSessionEvent(value);
}

export function validateReviewSessionEventSequence(events: readonly ReviewSessionEvent[], sessionId: string): void {
  assertValidSessionId(sessionId);
  if (!events.some((event) => event.type === "phase-transitioned")) {
    validateLegacyReviewSessionEventSequence(events, sessionId);
    return;
  }
  let currentPhase: ReviewRuntimePhase | "session-created" = "session-created";
  let terminalPhase: "session-finished" | "session-cancelled" | undefined;
  let terminalEventSeen = false;
  for (const event of events) {
    if (event.sessionId !== sessionId) throw new Error("Event sessionId does not match sessionId");
    if (event.type !== "phase-transitioned") {
      if (event.type === "session-finished" || event.type === "session-cancelled") {
        if (terminalEventSeen) throw new Error("终态事件只能出现一次");
        if (event.type !== terminalPhase) throw new Error(`legacy 终态事件与 phase 不匹配: ${event.type} != ${terminalPhase ?? "none"}`);
        terminalEventSeen = true;
        continue;
      }
      if (terminalPhase || terminalEventSeen) throw new Error("事件序列在终态后仍有事件");
      continue;
    }
    if (terminalPhase || terminalEventSeen) throw new Error("终态 phase 后禁止追加事件");
    if (event.previousPhase !== currentPhase) throw new Error(`事件序列阶段断裂: ${currentPhase} -> ${event.previousPhase}`);
    if (event.unitResult && event.unitResult.unitId !== event.unitId) throw new Error("unitResult.unitId 与阶段事件 unitId 不一致");
    currentPhase = event.phase;
    terminalPhase = event.phase === "session-finished" || event.phase === "session-cancelled" ? event.phase : undefined;
  }
}

function validateLegacyReviewSessionEventSequence(events: readonly ReviewSessionEvent[], sessionId: string): void {
  let started = false;
  let terminal = false;

  for (const event of events) {
    if (event.sessionId !== sessionId) throw new Error("Event sessionId does not match sessionId");
    if (terminal) throw new Error("事件序列在终态后仍有事件");

    if (event.type === "session-started") {
      if (started) throw new Error("legacy session-started 只能出现一次");
      started = true;
      continue;
    }
    if (event.type === "unit-completed" || event.type === "unit-failed") {
      if (!started) throw new Error("legacy unit 事件必须位于 session-started 之后");
      continue;
    }
    if (event.type === "session-finished" || event.type === "session-cancelled") {
      if (!started) throw new Error("legacy 终态事件必须位于 session-started 之后");
      terminal = true;
    }
  }
}

export function migrateReviewSessionEvent(value: unknown): ReviewSessionEvent {
  if (typeof value === "object" && value !== null && (value as { type?: unknown }).type === "phase-transitioned") {
    const event = value as Record<string, unknown>;
    return reviewSessionEventSchema.parse({
      ...event,
      schemaVersion: REVIEW_SCHEMA_VERSION,
      runtimeVersion: typeof event.runtimeVersion === "string" ? event.runtimeVersion : "legacy"
    });
  }
  return reviewSessionEventSchema.parse(value);
}
