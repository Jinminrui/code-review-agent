import { describe, expect, it } from "vitest";
import { buildReviewUnits } from "../src/infrastructure/planner/review-unit-planner.js";

describe("buildReviewUnits", () => {
  it("creates one unit per changed file in MVP mode", () => {
    const units = buildReviewUnits([
      { path: "src/a.ts", hunks: [] },
      { path: "src/b.ts", hunks: [] }
    ]);

    expect(units).toHaveLength(2);
    expect(units[0]?.primaryFile).toBe("src/a.ts");
  });

  it("keeps primary file even when hunks are empty", () => {
    const units = buildReviewUnits([{ path: "src/new.ts", hunks: [] }]);

    expect(units[0]?.files).toEqual(["src/new.ts"]);
  });
});
