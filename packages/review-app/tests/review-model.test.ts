/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { describe, expect, it } from "vitest";
import { reviewSessionDetailSchema, sessionSummarySchema, createInitialReviewProgress, reduceReviewProgress, type ReviewProgressState } from "../src/lib/review-model";
import type { ReviewSessionEvent } from "../src/lib/review-model";

describe("reviewSessionDetailSchema", () => {
  it("accepts a minimal session detail payload", () => {
    const result = reviewSessionDetailSchema.parse({
      sessionId: "s_1",
      status: "running",
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature",
      summary: {
        changedFilesCount: 1,
        findingsCount: 0,
        highSeverityCount: 0,
        files: ["src/a.ts"]
      },
      diffByFile: {
        "src/a.ts": {
          original: "",
          modified: ""
        }
      },
      findings: []
    });

    expect(result.summary.changedFilesCount).toBe(1);
  });
});

describe("review model cancellation", () => {
  it("accepts cancelled sessions and createdAt", () => {
    const detail = reviewSessionDetailSchema.parse({
      sessionId: "s_1",
      status: "cancelled",
      createdAt: "2026-06-19T00:00:00.000Z",
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature",
      summary: {
        changedFilesCount: 1,
        findingsCount: 0,
        highSeverityCount: 0,
        files: ["src/a.ts"]
      },
      diffByFile: {},
      findings: []
    });

    const summary = sessionSummarySchema.parse({
      sessionId: "s_1",
      status: "cancelled",
      createdAt: "2026-06-19T00:00:00.000Z",
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature",
      summary: {
        changedFilesCount: 1,
        findingsCount: 0,
        highSeverityCount: 0,
        files: ["src/a.ts"]
      }
    });

    expect(detail.status).toBe("cancelled");
    expect(summary.createdAt).toBe("2026-06-19T00:00:00.000Z");
  });
});

describe("ReviewSessionEvent", () => {
  it("types unit-completed events with streaming diff content", () => {
    const event: ReviewSessionEvent = {
      type: "unit-completed",
      sessionId: "s_1",
      unitId: "unit:src/file.ts",
      findingsCount: 0,
      findings: [],
      diffByFile: {
        "src/file.ts": {
          original: "before\n",
          modified: "after\n"
        }
      }
    };

    expect(event.diffByFile["src/file.ts"]?.modified).toBe("after\n");
  });
});

describe("review progress projection", () => {
  it("maps runtime phases to the five UI phases and keeps structured unit data", () => {
    const state = reduceReviewProgress(undefined, {
      type: "phase-transitioned",
      sessionId: "s_1",
      schemaVersion: 1,
      runtimeVersion: "hybrid-1",
      previousPhase: "unit-plan-started",
      phase: "react-evidence-collecting",
      unitId: "unit:src/a.ts",
      planSnapshot: {
        version: 1,
        changeSetSummary: { files: ["src/a.ts"], totalInsertions: 2, totalDeletions: 1 },
        riskAreas: [],
        units: [{
          unitId: "unit:src/a.ts",
          file: "src/a.ts",
          order: 0,
          checks: [{ id: "check-1", description: "检查输入", completionCriteria: ["有证据"], allowedFiles: ["src/a.ts"], evidenceTargets: ["函数"] }],
          budget: { modelCalls: 1, toolCalls: 2, maxInputTokens: 1000, maxOutputTokens: 500, maxReadBytes: 1000, maxDurationMs: 1000 }
        }]
      }
    });

    expect(state.phase).toBe("evidence");
    expect(state.currentUnit).toBe("unit:src/a.ts");
    expect(state.checks).toEqual([{ id: "check-1", description: "检查输入", status: "不可用" }]);
    expect(state.budget).toEqual({ modelCalls: 1, toolCalls: 2, maxInputTokens: 1000, maxOutputTokens: 500, maxReadBytes: 1000, maxDurationMs: 1000 });
  });

  it("keeps basic progress for legacy events", () => {
    const state = reduceReviewProgress(undefined, {
      type: "unit-completed", sessionId: "s_1", unitId: "unit:a", findingsCount: 1, findings: [], diffByFile: {}
    });
    expect(state.phase).toBe("pre-analysis");
    expect(state.degradation).toBeNull();
  });

  it("does not invent a degradation for normal legacy completion", () => {
    const initial: ReviewProgressState = { ...reduceReviewProgress(undefined, { type: "session-started", sessionId: "s_1" }), degradation: null };
    const state = reduceReviewProgress(initial, {
      type: "unit-completed", sessionId: "s_1", unitId: "unit:a", findingsCount: 0, findings: [], diffByFile: {}
    });
    expect(state.degradation).toBeNull();
  });

  it("keeps the current phase after one unit completes in a multi-file session", () => {
    const state = reduceReviewProgress({ ...createInitialReviewProgress(), phase: "validation" }, {
      type: "unit-completed", sessionId: "s_1", unitId: "unit:a", findingsCount: 0, findings: [], diffByFile: {}
    });
    expect(state.phase).toBe("validation");
  });
});
