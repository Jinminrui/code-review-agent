/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewSessionPage } from "../src/pages/review-session-page";
import { useReviewSessionStore } from "../src/store/review-session-store";

describe("ReviewSessionPage", () => {
  beforeEach(() => {
    useReviewSessionStore.setState({
      session: null,
      selectedFindingId: null
    });
  });

  it("renders review workbench regions in Chinese after loading session detail", async () => {
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn(),
      selectRepository: vi.fn(),
      listBranches: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn().mockResolvedValue({
        sessionId: "s_1",
        status: "running",
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
      listSessions: vi.fn(),
      deleteSession: vi.fn(),
      cancelSession: vi.fn(),
      exportSession: vi.fn(),
      subscribeSession: vi.fn().mockReturnValue(() => {})
    };

    render(
      <MemoryRouter initialEntries={["/sessions/s_1"]}>
        <Routes>
          <Route path="/sessions/:sessionId" element={<ReviewSessionPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("审查中...")).toBeInTheDocument();
    });

    // 侧边栏头部 - running 状态显示中止按钮
    expect(screen.getByRole("button", { name: /中止审查/ })).toBeInTheDocument();

    // 会话进度区域
    expect(screen.getByText("session-status")).toBeInTheDocument();
    expect(screen.getByText("review-trace")).toBeInTheDocument();

    // 审查摘要区域
    expect(screen.getByText("session-summary")).toBeInTheDocument();
    expect(screen.getByText("files")).toBeInTheDocument();
    expect(screen.getAllByText("findings").length).toBeGreaterThan(0);
    expect(screen.getByText("high")).toBeInTheDocument();

    // 风险文件列表
    expect(screen.getByText("risk-files")).toBeInTheDocument();
    expect(screen.getAllByText("src/a.ts").length).toBeGreaterThan(0);

    // Finding 列表
    expect(screen.getByRole("button", { name: /空值保护缺失/ })).toBeInTheDocument();
  });
});
