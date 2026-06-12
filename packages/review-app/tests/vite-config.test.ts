import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("vite.config", () => {
  it("uses relative base path for file:// protocol compatibility", () => {
    // When loaded via file:// in a packaged Electron app, absolute paths
    // like "/assets/index.js" would 404. Using "./" produces relative
    // paths like "./assets/index.js" that work under any protocol.
    const configSource = readFileSync(
      resolve(__dirname, "../vite.config.ts"),
      "utf-8"
    );
    expect(configSource).toContain('base: "./"');
  });
});
