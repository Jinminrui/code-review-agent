import { describe, expect, it } from "vitest";
import { getPreloadFilename } from "../src/runtime-config.js";

describe("getPreloadFilename", () => {
  it("uses a CommonJS preload output filename", () => {
    expect(getPreloadFilename()).toBe("preload.cjs");
  });
});
