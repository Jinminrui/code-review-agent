import { describe, expect, it } from "vitest";
import { reviewSessionDetailSchema } from "../src/lib/review-model";

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
      findings: []
    });

    expect(result.summary.changedFilesCount).toBe(1);
  });
});
