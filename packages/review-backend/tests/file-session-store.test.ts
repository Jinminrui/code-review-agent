/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
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

  it("stores createdAt and lists newest sessions first", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "review-store-"));
    const store = new FileSessionStore(rootDir);

    const first = await store.createSession({
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature-a"
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await store.createSession({
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature-b"
    });

    const firstDetail = await store.getSession(first.sessionId);
    const sessions = await store.listSessions();

    expect(firstDetail.createdAt).toEqual(expect.any(String));
    expect(sessions.map((session) => session.sessionId)).toEqual([
      second.sessionId,
      first.sessionId
    ]);
  });

  it("deletes a session and its directory", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "review-store-"));
    const store = new FileSessionStore(rootDir);

    const session = await store.createSession({
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature"
    });

    // 确认会话存在
    await expect(store.getSession(session.sessionId)).resolves.toBeDefined();
    await expect(store.listSessions()).resolves.toHaveLength(1);

    // 删除会话
    await store.deleteSession(session.sessionId);

    // 确认会话已删除
    await expect(store.getSession(session.sessionId)).rejects.toThrow();
    await expect(store.listSessions()).resolves.toHaveLength(0);
  });

  it("throws error when deleting non-existent session", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "review-store-"));
    const store = new FileSessionStore(rootDir);

    await expect(store.deleteSession("non-existent-id"))
      .rejects.toThrow("Session non-existent-id not found");
  });

  it("rejects sessionId with path traversal characters", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "review-store-"));
    const store = new FileSessionStore(rootDir);

    await expect(store.deleteSession("../etc/passwd"))
      .rejects.toThrow("Invalid sessionId");
    await expect(store.deleteSession("foo/bar"))
      .rejects.toThrow("Invalid sessionId");
    await expect(store.deleteSession("foo\\bar"))
      .rejects.toThrow("Invalid sessionId");
  });

  it("exports session to markdown format", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "review-store-"));
    const store = new FileSessionStore(rootDir);

    const session = await store.createSession({
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature"
    });

    await store.completeSession(session.sessionId, {
      sessionId: session.sessionId,
      status: "finished",
      summary: {
        changedFilesCount: 2,
        findingsCount: 1,
        highSeverityCount: 1,
        files: ["src/a.ts"]
      },
      findings: [
        {
          id: "f_1",
          severity: "high",
          category: "security",
          summary: "SQL injection vulnerability",
          explanation: "User input is not sanitized",
          file: "src/a.ts",
          startLine: 10,
          endLine: 15,
          status: "line-level",
          confidenceSignals: ["direct-input"]
        }
      ],
      diffByFile: {}
    });

    const markdown = await store.exportSessionToMarkdown(session.sessionId);

    expect(markdown).toContain("# 代码审查报告");
    expect(markdown).toContain("## 基本信息");
    expect(markdown).toContain(`**会话 ID**：${session.sessionId}`);
    expect(markdown).toContain("## 审查摘要");
    expect(markdown).toContain("## 问题列表");
    expect(markdown).toContain("SQL injection vulnerability");
  });

  it("exports session with empty findings", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "review-store-"));
    const store = new FileSessionStore(rootDir);

    const session = await store.createSession({
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature"
    });

    await store.completeSession(session.sessionId, {
      sessionId: session.sessionId,
      status: "finished",
      summary: {
        changedFilesCount: 1,
        findingsCount: 0,
        highSeverityCount: 0,
        files: ["src/a.ts"]
      },
      findings: [],
      diffByFile: {}
    });

    const markdown = await store.exportSessionToMarkdown(session.sessionId);

    expect(markdown).toContain("暂无问题");
  });

  it("exports finding with optional fields", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "review-store-"));
    const store = new FileSessionStore(rootDir);

    const session = await store.createSession({
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature"
    });

    await store.completeSession(session.sessionId, {
      sessionId: session.sessionId,
      status: "finished",
      summary: {
        changedFilesCount: 1,
        findingsCount: 1,
        highSeverityCount: 0,
        files: ["src/a.ts"]
      },
      findings: [
        {
          id: "f_1",
          severity: "medium",
          category: "style",
          summary: "Missing type annotation",
          explanation: "Variable should have explicit type",
          file: "src/a.ts",
          startLine: 5,
          endLine: 5,
          suggestion: "Add explicit type annotation",
          status: "line-level",
          confidenceSignals: []
        }
      ],
      diffByFile: {}
    });

    const markdown = await store.exportSessionToMarkdown(session.sessionId);

    expect(markdown).toContain("- **建议**：Add explicit type annotation");
    expect(markdown).toContain("- **行号**：5-5");
  });

  it("throws error when exporting non-existent session", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "review-store-"));
    const store = new FileSessionStore(rootDir);

    await expect(store.exportSessionToMarkdown("non-existent-id")).rejects.toThrow();
  });

  it("persists and reads back a cancelled session", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "review-store-"));
    const store = new FileSessionStore(rootDir);

    const session = await store.createSession({
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature"
    });

    await store.completeSession(session.sessionId, {
      sessionId: session.sessionId,
      status: "cancelled",
      summary: {
        changedFilesCount: 0,
        findingsCount: 0,
        highSeverityCount: 0,
        files: []
      },
      findings: [],
      diffByFile: {}
    });

    await expect(store.getSession(session.sessionId)).resolves.toMatchObject({
      sessionId: session.sessionId,
      status: "cancelled"
    });

    const sessions = await store.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.status).toBe("cancelled");
  });
});
