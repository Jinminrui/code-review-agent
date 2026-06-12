import { describe, expect, it } from "vitest";
import { getPreloadFilename, getRendererUrl } from "../src/runtime-config.js";

describe("getRendererUrl", () => {
  it("uses the desktop dev default when env is empty", () => {
    expect(getRendererUrl({})).toBe("http://127.0.0.1:5173");
  });

  it("prefers REVIEW_RENDERER_URL when provided", () => {
    expect(
      getRendererUrl({
        REVIEW_RENDERER_URL: "http://127.0.0.1:4300"
      })
    ).toBe("http://127.0.0.1:4300");
  });

  it("uses a CommonJS preload output filename", () => {
    expect(getPreloadFilename()).toBe("preload.cjs");
  });

  it("returns file:// URL in production mode when no env override", () => {
    const result = getRendererUrl({}, { isPackaged: true, appPath: "/Users/test/app" });
    expect(result).toBe("file:///Users/test/app/renderer/index.html");
  });

  it("prefers REVIEW_RENDERER_URL even in production mode", () => {
    const result = getRendererUrl(
      { REVIEW_RENDERER_URL: "http://custom:9999" },
      { isPackaged: true, appPath: "/Users/test/app" }
    );
    expect(result).toBe("http://custom:9999");
  });
});
