import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";
import { GitClient } from "../src/infrastructure/git/git-client.js";
import { parseUnifiedDiff } from "../src/infrastructure/git/parse-unified-diff.js";
describe("parseUnifiedDiff", () => {
    it("parses file paths and hunk headers", () => {
        const files = parseUnifiedDiff(`
diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
-const a = 1;
+const a = 2;
+const b = 3;
`);
        expect(files).toHaveLength(1);
        expect(files[0]?.path).toBe("src/a.ts");
        expect(files[0]?.hunks[0]?.newStart).toBe(1);
    });
});
describe("GitClient", () => {
    it("lists branches from a temporary repo", async () => {
        const repo = await mkdtemp(join(tmpdir(), "review-backend-"));
        await execa("git", ["init", "-b", "main"], { cwd: repo });
        await mkdir(join(repo, "src"), { recursive: true });
        await writeFile(join(repo, "src", "a.ts"), "export const a = 1;\n");
        await execa("git", ["add", "."], { cwd: repo });
        await execa("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"], { cwd: repo });
        const client = new GitClient(repo);
        const branches = await client.listBranches();
        expect(branches).toContain("main");
    });
});
