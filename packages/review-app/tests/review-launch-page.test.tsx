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

    fireEvent.change(await screen.findByLabelText("仓库"), { target: { value: "/repo" } });
    fireEvent.change(await screen.findByLabelText("Base 分支"), { target: { value: "main" } });
    fireEvent.change(await screen.findByLabelText("Target 分支"), { target: { value: "feature" } });
    fireEvent.click(screen.getByRole("button", { name: "开始审查" }));

    await waitFor(() => {
      expect(window.reviewWorkbenchApi.createSession).toHaveBeenCalledWith({
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "feature",
        providerProfileId: "default"
      });
    });
  });
});
