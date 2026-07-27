import { describe, expect, it, vi } from "vitest";
import { loadDotEnv } from "../src/environment.js";

describe("loadDotEnv", () => {
  it("从项目根目录加载 .env 文件", () => {
    const config = vi.fn();

    loadDotEnv(config);

    expect(config).toHaveBeenCalledWith({
      path: expect.stringMatching(/\.env$/)
    });
  });
});
