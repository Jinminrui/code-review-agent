import { join } from "node:path";

export function resolveSessionsRoot(rootDir: string) {
  return join(rootDir, "sessions");
}
