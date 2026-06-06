import { describe, expect, it, vi } from "vitest";
import { createReviewWorkbenchHandlers } from "../src/ipc/review-workbench-handlers.js";
describe("createReviewWorkbenchHandlers", () => {
    it("creates session and forwards follow-up reads", async () => {
        const backend = {
            listRepositories: vi.fn().mockResolvedValue(["/repo"]),
            listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
            createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
            getSession: vi.fn().mockResolvedValue({ sessionId: "s_1", status: "running" }),
            listSessions: vi.fn().mockResolvedValue([])
        };
        const handlers = createReviewWorkbenchHandlers({ backend });
        await expect(handlers.listRepositories()).resolves.toEqual(["/repo"]);
        await expect(handlers.createSession({
            repositoryPath: "/repo",
            baseRef: "main",
            targetRef: "feature",
            providerProfileId: "default",
            contextBudgetTokens: 12000
        })).resolves.toEqual({ sessionId: "s_1" });
        await expect(handlers.getSession("s_1")).resolves.toMatchObject({ sessionId: "s_1" });
    });
});
