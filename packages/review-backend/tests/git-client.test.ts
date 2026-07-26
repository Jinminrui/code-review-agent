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
    await execa(
      "git",
      ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"],
      { cwd: repo }
    );

    const client = new GitClient(repo);
    const branches = await client.listBranches();

    expect(branches).toContain("main");
  });

  it("reads workspace diff with staged and unstaged changes", async () => {
    const repo = await mkdtemp(join(tmpdir(), "review-backend-"));
    await execa("git", ["init", "-b", "main"], { cwd: repo });
    await execa("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "config", "user.name", "Test"], { cwd: repo });
    await execa("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "config", "user.email", "test@example.com"], { cwd: repo });

    // Create initial commit
    await writeFile(join(repo, "file.txt"), "initial content\n");
    await execa("git", ["add", "."], { cwd: repo });
    await execa(
      "git",
      ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"],
      { cwd: repo }
    );

    // Make staged change
    await writeFile(join(repo, "file.txt"), "staged change\n");
    await execa("git", ["add", "file.txt"], { cwd: repo });

    // Make unstaged change
    await writeFile(join(repo, "unstaged.txt"), "unstaged content\n");

    const client = new GitClient(repo);
    const diff = await client.readWorkspaceDiff();

    expect(diff).toBeDefined();
    expect(Array.isArray(diff)).toBe(true);
    expect(diff.length).toBeGreaterThan(0);

    // Should contain the staged file
    const fileNames = diff.map((f) => f.path);
    expect(fileNames).toContain("file.txt");
  });

  it("reads working tree file content for the WORKSPACE ref", async () => {
    const repo = await mkdtemp(join(tmpdir(), "review-backend-"));
    await execa("git", ["init", "-b", "main"], { cwd: repo });
    await writeFile(join(repo, "file.txt"), "committed content\n");
    await execa("git", ["add", "."], { cwd: repo });
    await execa(
      "git",
      ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"],
      { cwd: repo }
    );
    await writeFile(join(repo, "file.txt"), "workspace content\n");

    const client = new GitClient(repo);
    const content = await client.readFileAtRef("WORKSPACE", "file.txt");

    expect(content).toBe("workspace content\n");
  });

  it("lsFiles returns tracked files", async () => {
    const repo = await mkdtemp(join(tmpdir(), "review-backend-"));
    await execa("git", ["init", "-b", "main"], { cwd: repo });
    await mkdir(join(repo, "src"), { recursive: true });
    await writeFile(join(repo, "src", "a.ts"), "export const a = 1;\n");
    await writeFile(join(repo, "src", "b.ts"), "export const b = 2;\n");
    await writeFile(join(repo, "README.md"), "# Test\n");
    await execa("git", ["add", "."], { cwd: repo });
    await execa(
      "git",
      ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"],
      { cwd: repo }
    );

    const client = new GitClient(repo);
    const files = await client.lsFiles();

    expect(files).toContain("src/a.ts");
    expect(files).toContain("src/b.ts");
    expect(files).toContain("README.md");
  });

  it("lsFiles with glob filter returns only matching files", async () => {
    const repo = await mkdtemp(join(tmpdir(), "review-backend-"));
    await execa("git", ["init", "-b", "main"], { cwd: repo });
    await mkdir(join(repo, "src"), { recursive: true });
    await writeFile(join(repo, "src", "a.ts"), "export const a = 1;\n");
    await writeFile(join(repo, "src", "b.js"), "export const b = 2;\n");
    await writeFile(join(repo, "README.md"), "# Test\n");
    await execa("git", ["add", "."], { cwd: repo });
    await execa(
      "git",
      ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"],
      { cwd: repo }
    );

    const client = new GitClient(repo);
    const files = await client.lsFiles("*.ts");

    expect(files).toContain("src/a.ts");
    expect(files).not.toContain("src/b.js");
    expect(files).not.toContain("README.md");
  });

  it("grep finds text matches", async () => {
    const repo = await mkdtemp(join(tmpdir(), "review-backend-"));
    await execa("git", ["init", "-b", "main"], { cwd: repo });
    await mkdir(join(repo, "src"), { recursive: true });
    await writeFile(join(repo, "src", "a.ts"), "export const foo = 1;\nexport const bar = 2;\n");
    await writeFile(join(repo, "src", "b.ts"), "export const baz = 3;\n");
    await execa("git", ["add", "."], { cwd: repo });
    await execa(
      "git",
      ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"],
      { cwd: repo }
    );

    const client = new GitClient(repo);
    const results = await client.grep("foo");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toContain("src/a.ts");
    expect(results[0]).toContain("foo");
  });

  it("grep with regex mode works", async () => {
    const repo = await mkdtemp(join(tmpdir(), "review-backend-"));
    await execa("git", ["init", "-b", "main"], { cwd: repo });
    await mkdir(join(repo, "src"), { recursive: true });
    await writeFile(join(repo, "src", "a.ts"), "const foo = 1;\nconst bar = 2;\nconst foobar = 3;\n");
    await execa("git", ["add", "."], { cwd: repo });
    await execa(
      "git",
      ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"],
      { cwd: repo }
    );

    const client = new GitClient(repo);
    const results = await client.grep("^const foo =", { regex: true });

    expect(results.length).toBe(1);
    expect(results[0]).toContain("const foo = 1;");
  });

  it("grep accepts pathspec filters while keeping other files out of the result", async () => {
    const repo = await mkdtemp(join(tmpdir(), "review-backend-"));
    await execa("git", ["init", "-b", "main"], { cwd: repo });
    await mkdir(join(repo, "src"), { recursive: true });
    await writeFile(join(repo, "src", "a.ts"), "const AuthService = 1;\n");
    await writeFile(join(repo, "src", "b.ts"), "const AuthService = 2;\n");
    await execa("git", ["add", "."], { cwd: repo });
    await execa(
      "git",
      ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"],
      { cwd: repo }
    );

    const client = new GitClient(repo);
    const results = await client.grep("AuthService", { paths: ["src/a.ts"] });

    expect(results).toEqual(["src/a.ts:1:const AuthService = 1;"]);
  });

  it("grep treats paths as literal pathspecs", async () => {
    const repo = await mkdtemp(join(tmpdir(), "review-backend-"));
    await execa("git", ["init", "-b", "main"], { cwd: repo });
    await mkdir(join(repo, "src"), { recursive: true });
    await writeFile(join(repo, "src", "a*.ts"), "const AuthService = 1;\n");
    await writeFile(join(repo, "src", "abc.ts"), "const AuthService = 2;\n");
    await execa("git", ["add", "."], { cwd: repo });
    await execa(
      "git",
      ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"],
      { cwd: repo }
    );

    const client = new GitClient(repo);
    const results = await client.grep("AuthService", { paths: ["src/a*.ts"] });

    expect(results).toEqual(["src/a*.ts:1:const AuthService = 1;"]);
  });

  it("grep returns empty array when no matches", async () => {
    const repo = await mkdtemp(join(tmpdir(), "review-backend-"));
    await execa("git", ["init", "-b", "main"], { cwd: repo });
    await writeFile(join(repo, "file.txt"), "hello world\n");
    await execa("git", ["add", "."], { cwd: repo });
    await execa(
      "git",
      ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"],
      { cwd: repo }
    );

    const client = new GitClient(repo);
    const results = await client.grep("nonexistent");

    expect(results).toEqual([]);
  });
});
