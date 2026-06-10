import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewLaunchPage } from "../src/pages/review-launch-page";

describe("ReviewLaunchPage", () => {
  afterEach(() => {
    cleanup();
  });
  it("submits repository and branch selection", async () => {
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn().mockResolvedValue(["/repo"]),
      listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
      getSession: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      deleteSession: vi.fn(),
      exportSession: vi.fn(),
      subscribeSession: vi.fn()
    };

    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("启动代码审查")).toBeInTheDocument();
    expect(screen.getByText("选择仓库和分支，开始审查代码变更")).toBeInTheDocument();

    const selects = await screen.findAllByRole("combobox");
    fireEvent.change(selects[0]!, { target: { value: "/repo" } });

    // 等待分支列表加载（通过检查第二个 select 的选项数量）
    await waitFor(() => {
      expect(selects[1]!.querySelectorAll("option").length).toBeGreaterThan(1);
    });

    fireEvent.change(selects[1]!, { target: { value: "main" } });
    fireEvent.change(selects[2]!, { target: { value: "feature" } });
    fireEvent.click(screen.getByRole("button", { name: /start-review/ }));

    await waitFor(() => {
      expect(window.reviewWorkbenchApi.createSession).toHaveBeenCalledWith({
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "feature"
      });
    });
  });

  it("renders workspace review button", async () => {
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn().mockResolvedValue(["/repo"]),
      listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_2" }),
      getSession: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      deleteSession: vi.fn(),
      exportSession: vi.fn(),
      subscribeSession: vi.fn()
    };

    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>
    );

    expect(await screen.findAllByText("启动代码审查")).toHaveLength(1);
    const workspaceButtons = screen.getAllByRole("button", { name: /review-workspace/ });
    expect(workspaceButtons.length).toBeGreaterThan(0);
  });

  it("submits workspace review with WORKSPACE targetRef", async () => {
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn().mockResolvedValue(["/repo"]),
      listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_3" }),
      getSession: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      deleteSession: vi.fn(),
      exportSession: vi.fn(),
      subscribeSession: vi.fn()
    };

    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>
    );

    await screen.findByText("启动代码审查");

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0]!, { target: { value: "/repo" } });

    // 等待仓库选择生效
    await waitFor(() => {
      expect(selects[0]).toHaveValue("/repo");
    });

    const workspaceButtons = screen.getAllByRole("button", { name: /review-workspace/ });
    fireEvent.click(workspaceButtons[0]!);

    await waitFor(() => {
      expect(window.reviewWorkbenchApi.createSession).toHaveBeenCalledWith({
        repositoryPath: "/repo",
        baseRef: "HEAD",
        targetRef: "WORKSPACE"
      });
    });
  });
});
