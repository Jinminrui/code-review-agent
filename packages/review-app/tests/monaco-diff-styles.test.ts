import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Monaco diff styles", () => {
  it("overrides Monaco insert and delete classes used by inline diff mode", () => {
    const cssPath = resolve(__dirname, "../src/styles/globals.css");
    const css = readFileSync(cssPath, "utf8");

    expect(css).toContain(".monaco-editor .line-insert");
    expect(css).toContain(".monaco-editor .char-insert");
    expect(css).toContain(".monaco-editor .line-delete");
    expect(css).toContain(".monaco-editor .char-delete");
  });
});
