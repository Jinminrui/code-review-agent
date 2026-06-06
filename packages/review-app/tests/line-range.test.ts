import { describe, expect, it } from "vitest";
import { toLineRange } from "../src/components/diff/line-range";

describe("toLineRange", () => {
  it("uses file-level fallback when no startLine exists", () => {
    expect(toLineRange({ status: "file-level" })).toEqual({ startLine: 1, endLine: 1 });
  });
});
