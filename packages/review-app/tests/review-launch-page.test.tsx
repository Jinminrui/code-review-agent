/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
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
      selectRepository: vi.fn().mockResolvedValue("/repo"),
      listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
      getSession: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      deleteSession: vi.fn(),
      cancelSession: vi.fn(),
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

    // 点击选择仓库按钮
    fireEvent.click(screen.getByRole("button", { name: "选择仓库" }));

    // 等待仓库选择生效
    await waitFor(() => {
      expect(screen.getByText("/repo")).toBeInTheDocument();
    });

    // 等待分支列表加载
    await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      expect(selects[0]!.querySelectorAll("option").length).toBeGreaterThan(1);
    });

    // 选择分支
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0]!, { target: { value: "main" } });
    fireEvent.change(selects[1]!, { target: { value: "feature" } });

    // 提交表单
    fireEvent.click(screen.getByRole("button", { name: /start-review/ }));

    await waitFor(() => {
      expect(window.reviewWorkbenchApi.createSession).toHaveBeenCalledWith({
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "feature"
      });
    });
  });

  it("selects a local repository folder and loads its branches", async () => {
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn().mockResolvedValue(["/repo"]),
      selectRepository: vi.fn().mockResolvedValue("/Users/test/another-repo"),
      listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_4" }),
      getSession: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      deleteSession: vi.fn(),
      cancelSession: vi.fn(),
      exportSession: vi.fn(),
      subscribeSession: vi.fn()
    };

    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>
    );

    await screen.findByText("启动代码审查");

    fireEvent.click(screen.getByRole("button", { name: "选择仓库" }));

    await waitFor(() => {
      expect(screen.getByText("/Users/test/another-repo")).toBeInTheDocument();
    });

    expect(window.reviewWorkbenchApi.selectRepository).toHaveBeenCalledTimes(1);
    expect(window.reviewWorkbenchApi.listBranches).toHaveBeenCalledWith("/Users/test/another-repo");
  });

  it("renders workspace review button", async () => {
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn().mockResolvedValue(["/repo"]),
      selectRepository: vi.fn(),
      listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_2" }),
      getSession: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      deleteSession: vi.fn(),
      cancelSession: vi.fn(),
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
      selectRepository: vi.fn().mockResolvedValue("/repo"),
      listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_3" }),
      getSession: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      deleteSession: vi.fn(),
      cancelSession: vi.fn(),
      exportSession: vi.fn(),
      subscribeSession: vi.fn()
    };

    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>
    );

    await screen.findByText("启动代码审查");

    // 点击选择仓库按钮
    fireEvent.click(screen.getByRole("button", { name: "选择仓库" }));

    // 等待仓库选择生效
    await waitFor(() => {
      expect(screen.getByText("/repo")).toBeInTheDocument();
    });

    // 提交工作区审查
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

  it("prefills the default base branch without guessing the current target branch", async () => {
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn().mockResolvedValue(["/repo"]),
      selectRepository: vi.fn().mockResolvedValue("/repo"),
      listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_5" }),
      getSession: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      deleteSession: vi.fn(),
      cancelSession: vi.fn(),
      exportSession: vi.fn(),
      subscribeSession: vi.fn()
    };

    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "选择仓库" }));

    await waitFor(() => {
      expect(screen.getAllByRole("combobox")[0]).toHaveValue("main");
    });

    expect(screen.getAllByRole("combobox")[1]).toHaveValue("");
    expect(screen.getByText("请选择目标分支以开始审查")).toBeInTheDocument();
  });

  it("swaps base and target refs from the comparison preview", async () => {
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn().mockResolvedValue(["/repo"]),
      selectRepository: vi.fn().mockResolvedValue("/repo"),
      listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_6" }),
      getSession: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      deleteSession: vi.fn(),
      cancelSession: vi.fn(),
      exportSession: vi.fn(),
      subscribeSession: vi.fn()
    };

    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "选择仓库" }));
    await waitFor(() => expect(screen.getAllByRole("combobox")[0]).toHaveValue("main"));

    fireEvent.change(screen.getAllByRole("combobox")[1]!, { target: { value: "feature" } });
    expect(screen.getAllByText((_, element) => element?.textContent === "将审查 feature 相对 main 的改动")[0]).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "交换分支" }));

    expect(screen.getAllByRole("combobox")[0]).toHaveValue("feature");
    expect(screen.getAllByRole("combobox")[1]).toHaveValue("main");
    expect(screen.getAllByText((_, element) => element?.textContent === "将审查 main 相对 feature 的改动")[0]).toBeInTheDocument();
  });
});
