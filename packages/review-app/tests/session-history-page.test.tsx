import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
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
    expect(screen.getByText("3 files")).toBeInTheDocument();
    expect(screen.getByText("2 findings")).toBeInTheDocument();
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
});
