/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { describe, expect, it } from "vitest";
import { parseUnifiedDiff } from "../src/infrastructure/git/parse-unified-diff.js";

describe("parseUnifiedDiff", () => {
  it("parses file paths and hunk headers", () => {
    const files = parseUnifiedDiff(
      "diff --git a/src/a.ts b/src/a.ts\n" +
      "--- a/src/a.ts\n" +
      "+++ b/src/a.ts\n" +
      "@@ -1,2 +1,3 @@\n" +
      "-const a = 1;\n" +
      "+const a = 2;\n" +
      "+const b = 3;\n"
    );

    expect(files).toHaveLength(1);
    expect(files[0]?.path).toBe("src/a.ts");
    expect(files[0]?.hunks[0]?.newStart).toBe(1);
  });

  it("parses added lines with newLineNum but null oldLineNum", () => {
    const files = parseUnifiedDiff(
      "diff --git a/src/a.ts b/src/a.ts\n" +
      "--- a/src/a.ts\n" +
      "+++ b/src/a.ts\n" +
      "@@ -1,1 +1,2 @@\n" +
      " const a = 1;\n" +
      "+const b = 2;\n"
    );

    const lines = files[0]!.hunks[0]!.lines;
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      type: "context",
      content: "const a = 1;",
      oldLineNum: 1,
      newLineNum: 1
    });
    expect(lines[1]).toEqual({
      type: "added",
      content: "const b = 2;",
      oldLineNum: null,
      newLineNum: 2
    });
  });

  it("parses deleted lines with oldLineNum but null newLineNum", () => {
    const files = parseUnifiedDiff(
      "diff --git a/src/a.ts b/src/a.ts\n" +
      "--- a/src/a.ts\n" +
      "+++ b/src/a.ts\n" +
      "@@ -1,2 +1,1 @@\n" +
      " const a = 1;\n" +
      "-const b = 2;\n"
    );

    const lines = files[0]!.hunks[0]!.lines;
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      type: "context",
      content: "const a = 1;",
      oldLineNum: 1,
      newLineNum: 1
    });
    expect(lines[1]).toEqual({
      type: "deleted",
      content: "const b = 2;",
      oldLineNum: 2,
      newLineNum: null
    });
  });

  it("detects new file mode", () => {
    const files = parseUnifiedDiff(
      "diff --git a/src/new.ts b/src/new.ts\n" +
      "new file mode 100644\n" +
      "--- /dev/null\n" +
      "+++ b/src/new.ts\n" +
      "@@ -0,0 +1,1 @@\n" +
      "+export const x = 1;\n"
    );

    expect(files).toHaveLength(1);
    expect(files[0]?.isNew).toBe(true);
    expect(files[0]?.isDeleted).toBe(false);
    expect(files[0]?.insertions).toBe(1);
    expect(files[0]?.deletions).toBe(0);
  });

  it("detects deleted file mode", () => {
    const files = parseUnifiedDiff(
      "diff --git a/src/old.ts b/src/old.ts\n" +
      "deleted file mode 100644\n" +
      "--- a/src/old.ts\n" +
      "+++ /dev/null\n" +
      "@@ -1,1 +0,0 @@\n" +
      "-export const x = 1;\n"
    );

    expect(files).toHaveLength(1);
    expect(files[0]?.isDeleted).toBe(true);
    expect(files[0]?.isNew).toBe(false);
    expect(files[0]?.insertions).toBe(0);
    expect(files[0]?.deletions).toBe(1);
  });

  it("detects binary files", () => {
    const files = parseUnifiedDiff(
      "diff --git a/image.png b/image.png\n" +
      "Binary files a/image.png and b/image.png differ\n"
    );

    expect(files).toHaveLength(1);
    expect(files[0]?.isBinary).toBe(true);
  });

  it("counts insertions and deletions", () => {
    const files = parseUnifiedDiff(
      "diff --git a/src/a.ts b/src/a.ts\n" +
      "--- a/src/a.ts\n" +
      "+++ b/src/a.ts\n" +
      "@@ -1,3 +1,4 @@\n" +
      " const a = 1;\n" +
      "-const b = 2;\n" +
      "-const c = 3;\n" +
      "+const b = 20;\n" +
      "+const c = 30;\n" +
      "+const d = 4;\n"
    );

    expect(files[0]?.insertions).toBe(3);
    expect(files[0]?.deletions).toBe(2);
  });

  it("parses renamed files with oldPath", () => {
    const files = parseUnifiedDiff(
      "diff --git a/src/old-name.ts b/src/new-name.ts\n" +
      "similarity index 100%\n" +
      "rename from src/old-name.ts\n" +
      "rename to src/new-name.ts\n"
    );

    expect(files).toHaveLength(1);
    expect(files[0]?.path).toBe("src/new-name.ts");
    expect(files[0]?.oldPath).toBe("src/old-name.ts");
  });

  it("handles multiple files in one diff", () => {
    const files = parseUnifiedDiff(
      "diff --git a/src/a.ts b/src/a.ts\n" +
      "--- a/src/a.ts\n" +
      "+++ b/src/a.ts\n" +
      "@@ -1,1 +1,2 @@\n" +
      " const a = 1;\n" +
      "+const b = 2;\n" +
      "diff --git a/src/b.ts b/src/b.ts\n" +
      "--- a/src/b.ts\n" +
      "+++ b/src/b.ts\n" +
      "@@ -1,1 +1,1 @@\n" +
      "-const x = 1;\n" +
      "+const x = 2;\n"
    );

    expect(files).toHaveLength(2);
    expect(files[0]?.path).toBe("src/a.ts");
    expect(files[0]?.insertions).toBe(1);
    expect(files[1]?.path).toBe("src/b.ts");
    expect(files[1]?.insertions).toBe(1);
    expect(files[1]?.deletions).toBe(1);
  });

  it("defaults isNew and isDeleted to false for regular changes", () => {
    const files = parseUnifiedDiff(
      "diff --git a/src/a.ts b/src/a.ts\n" +
      "--- a/src/a.ts\n" +
      "+++ b/src/a.ts\n" +
      "@@ -1,1 +1,2 @@\n" +
      " const a = 1;\n" +
      "+const b = 2;\n"
    );

    expect(files[0]?.isNew).toBe(false);
    expect(files[0]?.isDeleted).toBe(false);
    expect(files[0]?.isBinary).toBe(false);
  });

  it("tracks line numbers correctly across multiple hunks", () => {
    const files = parseUnifiedDiff(
      "diff --git a/src/a.ts b/src/a.ts\n" +
      "--- a/src/a.ts\n" +
      "+++ b/src/a.ts\n" +
      "@@ -1,3 +1,3 @@\n" +
      " line1\n" +
      "-line2\n" +
      "+line2-modified\n" +
      " line3\n" +
      "@@ -10,3 +10,3 @@\n" +
      " line10\n" +
      "-line11\n" +
      "+line11-modified\n" +
      " line12\n"
    );

    const hunk0 = files[0]!.hunks[0]!;
    const hunk1 = files[0]!.hunks[1]!;

    // First hunk: lines 1-3
    expect(hunk0.lines[0]?.oldLineNum).toBe(1);
    expect(hunk0.lines[0]?.newLineNum).toBe(1);
    expect(hunk0.lines[1]?.type).toBe("deleted");
    expect(hunk0.lines[1]?.oldLineNum).toBe(2);
    expect(hunk0.lines[2]?.type).toBe("added");
    expect(hunk0.lines[2]?.newLineNum).toBe(2);
    expect(hunk0.lines[3]?.oldLineNum).toBe(3);
    expect(hunk0.lines[3]?.newLineNum).toBe(3);

    // Second hunk: lines 10-12 (line numbers continue from hunk header)
    expect(hunk1.lines[0]?.oldLineNum).toBe(10);
    expect(hunk1.lines[0]?.newLineNum).toBe(10);
  });
});
