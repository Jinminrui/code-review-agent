import { join } from "node:path";
export function resolveSessionsRoot(rootDir) {
    return join(rootDir, "sessions");
}
