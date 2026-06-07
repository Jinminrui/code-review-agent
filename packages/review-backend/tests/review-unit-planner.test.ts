import { describe, expect, it } from "vitest";
import { buildReviewUnits } from "../src/infrastructure/planner/review-unit-planner.js";
import type { ParsedDiffFile } from "../src/infrastructure/git/parse-unified-diff.js";

function makeFile(path: string): ParsedDiffFile {
  return { path, isNew: false, isDeleted: false, isBinary: false, insertions: 0, deletions: 0, hunks: [] };
}

describe("buildReviewUnits", () => {
  it("creates one unit per changed file in MVP mode", () => {
    const units = buildReviewUnits([
      makeFile("src/a.ts"),
      makeFile("src/b.ts")
    ]);

    expect(units).toHaveLength(2);
    expect(units[0]?.primaryFile).toBe("src/a.ts");
  });

  it("keeps primary file even when hunks are empty", () => {
    const units = buildReviewUnits([makeFile("src/new.ts")]);

    expect(units[0]?.files).toEqual(["src/new.ts"]);
  });
});
