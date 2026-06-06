import { jsx as _jsx } from "react/jsx-runtime";
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
    it("renders session status after loading session detail", async () => {
        window.reviewWorkbenchApi = {
            listRepositories: vi.fn(),
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
            subscribeSession: vi.fn().mockReturnValue(() => { })
        };
        render(_jsx(MemoryRouter, { initialEntries: ["/sessions/s_1"], children: _jsx(Routes, { children: _jsx(Route, { path: "/sessions/:sessionId", element: _jsx(ReviewSessionPage, {}) }) }) }));
        await waitFor(() => {
            expect(screen.getByText("当前状态：running")).toBeInTheDocument();
        });
        expect(screen.getByText("变更文件 1")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /空值保护缺失/ })).toBeInTheDocument();
    });
});
