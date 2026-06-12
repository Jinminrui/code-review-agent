import type { App } from "electron";
import { join } from "node:path";

/**
 * Returns the renderer entry URL/path.
 * - Dev mode: returns the Vite dev server URL
 * - Production (packaged): returns file:// URL to the bundled renderer HTML
 */
export function getRendererEntryPath(app: App): string {
  if (app.isPackaged) {
    return `file://${join(app.getAppPath(), "renderer", "index.html")}`;
  }

  return "http://127.0.0.1:5173";
}
