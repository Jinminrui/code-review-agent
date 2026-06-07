import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ReviewLaunchPage } from "../src/pages/review-launch-page";

describe("ReviewLaunchPage", () => {
  it("submits repository and branch selection", async () => {
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn().mockResolvedValue(["/repo"]),
      listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
      getSession: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      subscribeSession: vi.fn()
    };

    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Code Review Intake")).toBeInTheDocument();
    expect(screen.getByText("发起一次 Code Review")).toBeInTheDocument();
    expect(screen.getByText("改动摘要")).toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText("仓库"), { target: { value: "/repo" } });
    fireEvent.change(await screen.findByLabelText("基线分支"), { target: { value: "main" } });
    fireEvent.change(await screen.findByLabelText("目标分支"), { target: { value: "feature" } });
    fireEvent.click(screen.getByRole("button", { name: "开始 Code Review" }));

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
      subscribeSession: vi.fn()
    };

    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>
    );

    expect(await screen.findAllByText("Code Review Intake")).toHaveLength(2);
    const workspaceButtons = screen.getAllByRole("button", { name: "审查当前工作区改动" });
    expect(workspaceButtons.length).toBeGreaterThan(0);
  });

  it("submits workspace review with WORKSPACE targetRef", async () => {
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn().mockResolvedValue(["/repo"]),
      listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_3" }),
      getSession: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      subscribeSession: vi.fn()
    };

    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>
    );

    await screen.findAllByText("Code Review Intake");

    const repoSelects = screen.getAllByLabelText("仓库");
    fireEvent.change(repoSelects[0], { target: { value: "/repo" } });
    const workspaceButtons = screen.getAllByRole("button", { name: "审查当前工作区改动" });
    fireEvent.click(workspaceButtons[0]);

    await waitFor(() => {
      expect(window.reviewWorkbenchApi.createSession).toHaveBeenCalledWith({
        repositoryPath: "/repo",
        baseRef: "HEAD",
        targetRef: "WORKSPACE"
      });
    });
  });
});
