/**
 * 模块职责：连接 Electron 主进程、IPC 和 renderer，负责桌面生命周期与权限边界。
 * 边界约束：IPC 入参先校验，再调用 backend application；不要把主进程能力直接暴露给页面。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import type { CreateReviewSessionRequest } from "@app/review-backend";
import { createReviewSessionRequestSchema } from "@app/review-backend";

type ReviewWorkbenchBackend = {
  listRepositories(): Promise<string[]>;
  selectRepository(): Promise<string | null>;
  listBranches(repositoryPath: string): Promise<string[]>;
  createSession(request: CreateReviewSessionRequest): Promise<{ sessionId: string }>;
  getSession(sessionId: string): Promise<unknown>;
  listSessions(): Promise<unknown[]>;
  deleteSession(sessionId: string): Promise<void>;
  cancelSession(sessionId: string): Promise<void>;
  exportSessionToMarkdown(sessionId: string): Promise<string>;
};

export function createReviewWorkbenchHandlers(input: {
  backend: ReviewWorkbenchBackend;
}) {
  // 这是 renderer 到 backend 的唯一协议适配层：页面输入先过 zod，handler
  // 只负责协议转换，不在 IPC 层实现审查业务或绕过应用层规则。
  // handler 只做 IPC 入参校验和协议适配，具体业务继续留在 backend/application 层。
  return {
    listRepositories: () => input.backend.listRepositories(),
    selectRepository: () => input.backend.selectRepository(),
    listBranches: (repositoryPath: string) => input.backend.listBranches(repositoryPath),
    createSession: (request: unknown) =>
      input.backend.createSession(createReviewSessionRequestSchema.parse(request)),
    getSession: (sessionId: string) => input.backend.getSession(sessionId),
    listSessions: () => input.backend.listSessions(),
    deleteSession: (sessionId: string) => input.backend.deleteSession(sessionId),
    cancelSession: (sessionId: string) => input.backend.cancelSession(sessionId),
    exportSession: async (sessionId: string) => {
      const markdown = await input.backend.exportSessionToMarkdown(sessionId);
      return {
        markdown,
        filename: `review-${sessionId}.md`
      };
    }
  };
}
