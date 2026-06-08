import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SessionHistoryPage } from "../src/pages/session-history-page";

describe("SessionHistoryPage", () => {
  it("renders review session cards", async () => {
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn(),
      listBranches: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([
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
      ]),
      deleteSession: vi.fn(),
      exportSession: vi.fn(),
      subscribeSession: vi.fn()
    };

    render(
      <MemoryRouter initialEntries={["/sessions"]}>
        <Routes>
          <Route path="/sessions" element={<SessionHistoryPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Code Review 历史" })).toBeInTheDocument();
    expect(screen.getByText("Review Archive")).toBeInTheDocument();
    expect(screen.getByText("Review Record")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /main/i })).toBeInTheDocument();
    expect(screen.getByText("高风险 1")).toBeInTheDocument();
  });
});
