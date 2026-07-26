/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import type { ReviewWorkbenchApi } from "@/lib/ipc-client";

function createMockReviewWorkbenchApi(): ReviewWorkbenchApi {
  return {
    listRepositories: async () => ["/repo"],
    selectRepository: async () => "/repo",
    listBranches: async () => ["main", "feature"],
    createSession: async () => ({ sessionId: "s_1" }),
    getSession: async () => ({
      sessionId: "s_1",
      status: "finished",
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature",
      summary: {
        changedFilesCount: 1,
        findingsCount: 1,
        highSeverityCount: 1,
        files: ["src/a.ts"]
      },
      diffByFile: {
        "src/a.ts": {
          original: "export const a = 1;\n",
          modified: "export const a = 2;\n"
        }
      },
      findings: [
        {
          id: "f_1",
          severity: "high",
          category: "bug-risk",
          summary: "空值保护缺失",
          explanation: "调用链可能传入 undefined",
          file: "src/a.ts",
          startLine: 1,
          endLine: 1,
          confidenceSignals: [],
          status: "line-level"
        }
      ]
    }),
    listSessions: async () => [
      {
        sessionId: "s_1",
        status: "finished",
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "feature",
        summary: {
          changedFilesCount: 1,
          findingsCount: 1,
          highSeverityCount: 1,
          files: ["src/a.ts"]
        }
      }
    ],
    deleteSession: async () => {},
    cancelSession: async () => {},
    exportSession: async () => ({ markdown: "# Review", filename: "review.md" }),
    subscribeSession: () => () => {}
  };
}

export function ensureReviewWorkbenchApi() {
  if (!window.reviewWorkbenchApi) {
    window.reviewWorkbenchApi = createMockReviewWorkbenchApi();
  }
}
