/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { SessionHistoryPage } from "../src/pages/session-history-page";

const mockDeleteSession = vi.fn();
const mockExportSession = vi.fn();
const mockFetchSessions = vi.fn();

vi.mock("@/store/session-history-store", () => ({
  useSessionHistoryStore: () => ({
    sessions: [
      {
        sessionId: "s_1",
        status: "finished",
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "feature",
        summary: {
          changedFilesCount: 3,
          findingsCount: 2,
          highSeverityCount: 1,
          files: ["src/a.ts"]
        }
      },
      {
        sessionId: "s_2",
        status: "cancelled",
        createdAt: "2026-06-19T00:00:00.000Z",
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "workspace",
        summary: {
          changedFilesCount: 0,
          findingsCount: 0,
          highSeverityCount: 0,
          files: []
        }
      }
    ],
    isLoading: false,
    error: null,
    fetchSessions: mockFetchSessions,
    deleteSession: mockDeleteSession,
    exportSession: mockExportSession,
    clearError: vi.fn()
  })
}));

describe("SessionHistoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders session cards", async () => {
    render(
      <MemoryRouter initialEntries={["/sessions"]}>
        <Routes>
          <Route path="/sessions" element={<SessionHistoryPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("审查历史")).toBeInTheDocument();
    expect(screen.getByText("main → feature")).toBeInTheDocument();
    expect(screen.getByText("3 个文件")).toBeInTheDocument();
    expect(screen.getByText("2 个问题")).toBeInTheDocument();
  });

  it("calls deleteSession when delete is confirmed", async () => {
    render(
      <MemoryRouter initialEntries={["/sessions"]}>
        <Routes>
          <Route path="/sessions" element={<SessionHistoryPage />} />
        </Routes>
      </MemoryRouter>
    );

    // 使用 getAllByLabelText 获取所有删除按钮，取第一个（SessionCard 中的按钮）
    const deleteButtons = screen.getAllByLabelText("删除会话");
    fireEvent.click(deleteButtons[0]!);

    // 确认对话框出现
    expect(screen.getByText("确认删除")).toBeInTheDocument();

    // 点击确认删除 - 对话框中的删除按钮（使用 role="dialog" 定位）
    const dialog = screen.getByRole("dialog");
    const confirmButton = dialog.querySelector('button:last-child') as HTMLElement;
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteSession).toHaveBeenCalledWith("s_1");
    });
  });

  it("calls exportSession when export is clicked", async () => {
    render(
      <MemoryRouter initialEntries={["/sessions"]}>
        <Routes>
          <Route path="/sessions" element={<SessionHistoryPage />} />
        </Routes>
      </MemoryRouter>
    );

    // 使用 getAllByLabelText 获取导出按钮
    const exportButtons = screen.getAllByLabelText("导出会话");
    fireEvent.click(exportButtons[0]!);

    await waitFor(() => {
      expect(mockExportSession).toHaveBeenCalledWith("s_1");
    });
  });

  it("renders cancelled session status", () => {
    render(
      <MemoryRouter initialEntries={["/sessions"]}>
        <Routes>
          <Route path="/sessions" element={<SessionHistoryPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("已中止")).toBeInTheDocument();
  });
});
