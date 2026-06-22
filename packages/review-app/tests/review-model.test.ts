import { describe, expect, it } from "vitest";
import { reviewSessionDetailSchema, sessionSummarySchema } from "../src/lib/review-model";
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
