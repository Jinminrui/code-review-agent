/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SessionCard } from "../src/components/session/session-card";

describe("SessionCard", () => {
  const mockSession = {
    sessionId: "s_1",
    repositoryPath: "/Users/test/repo",
    baseRef: "main",
    targetRef: "feature",
    status: "finished" as const,
    summary: {
      changedFilesCount: 3,
      findingsCount: 2,
      highSeverityCount: 1,
      files: ["src/a.ts"]
    }
  };

  it("renders session information", () => {
    render(
      <MemoryRouter>
        <SessionCard session={mockSession} onDelete={vi.fn()} onExport={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByText("main → feature")).toBeInTheDocument();
    expect(screen.getByText("/Users/test/repo")).toBeInTheDocument();
    expect(screen.getByText("3 个文件")).toBeInTheDocument();
    expect(screen.getByText("2 个问题")).toBeInTheDocument();
    expect(screen.getByText("1 个高风险")).toBeInTheDocument();
  });

  it("calls onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(
      <MemoryRouter>
        <SessionCard session={mockSession} onDelete={onDelete} onExport={vi.fn()} />
      </MemoryRouter>
    );

    const deleteButtons = screen.getAllByLabelText("删除会话");
    const lastDeleteButton = deleteButtons[deleteButtons.length - 1];
    expect(lastDeleteButton).toBeDefined();
    await user.click(lastDeleteButton!);

    expect(onDelete).toHaveBeenCalledWith("s_1");
  });

  it("calls onExport when export button is clicked", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();

    render(
      <MemoryRouter>
        <SessionCard session={mockSession} onDelete={vi.fn()} onExport={onExport} />
      </MemoryRouter>
    );

    const exportButtons = screen.getAllByLabelText("导出会话");
    const lastExportButton = exportButtons[exportButtons.length - 1];
    expect(lastExportButton).toBeDefined();
    await user.click(lastExportButton!);

    expect(onExport).toHaveBeenCalledWith("s_1");
  });

  it("renders cancelled status with badge", () => {
    const cancelledSession = {
      ...mockSession,
      status: "cancelled" as const
    };

    render(
      <MemoryRouter>
        <SessionCard session={cancelledSession} onDelete={vi.fn()} onExport={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByText("已中止")).toBeInTheDocument();
  });

  it("links to session detail page", () => {
    render(
      <MemoryRouter>
        <SessionCard session={mockSession} onDelete={vi.fn()} onExport={vi.fn()} />
      </MemoryRouter>
    );

    const links = screen.getAllByRole("link");
    const sessionLink = links.find(link => link.getAttribute("href") === "/sessions/s_1");
    expect(sessionLink).toBeDefined();
    expect(sessionLink!).toHaveAttribute("href", "/sessions/s_1");
  });
});
