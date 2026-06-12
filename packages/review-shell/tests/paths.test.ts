import { describe, expect, it } from "vitest";
import { getRendererEntryPath, getRendererFilePath } from "../src/paths.js";

function createMockApp(options: { isPackaged: boolean; appPath: string }) {
  return {
    isPackaged: options.isPackaged,
    getAppPath: () => options.appPath
  } as unknown as import("electron").App;
}

describe("getRendererEntryPath", () => {
  it("returns dev server URL when not packaged", () => {
    const app = createMockApp({ isPackaged: false, appPath: "/some/path" });
    expect(getRendererEntryPath(app)).toBe("http://127.0.0.1:5173");
  });

  it("returns file:// path when packaged", () => {
    const app = createMockApp({ isPackaged: true, appPath: "/Users/test/app" });
    expect(getRendererEntryPath(app)).toBe(
      "file:///Users/test/app/renderer/index.html"
    );
  });
});

describe("getRendererFilePath", () => {
  it("returns plain file path when packaged (for loadFile)", () => {
    const app = createMockApp({ isPackaged: true, appPath: "/Users/test/app" });
    expect(getRendererFilePath(app)).toBe("/Users/test/app/renderer/index.html");
  });

  it("returns dev server URL when not packaged", () => {
    const app = createMockApp({ isPackaged: false, appPath: "/some/path" });
    expect(getRendererFilePath(app)).toBe("http://127.0.0.1:5173");
  });
});
