export type DiffLineType = "context" | "added" | "deleted";

export type ParsedDiffLine = {
  type: DiffLineType;
  content: string;
  oldLineNum: number | null;
  newLineNum: number | null;
};

export type ParsedDiffFile = {
  path: string;
  oldPath?: string;
  isNew: boolean;
  isDeleted: boolean;
  isBinary: boolean;
  insertions: number;
  deletions: number;
  hunks: Array<{
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    lines: ParsedDiffLine[];
  }>;
};

const HUNK_RE = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/;

export function parseUnifiedDiff(input: string): ParsedDiffFile[] {
  // Git diff 的文件元数据、hunk 头和行内容交错出现，因此用状态变量顺序解析。
  const lines = input.trimEnd().split("\n");
  const files: ParsedDiffFile[] = [];
  let currentFile: ParsedDiffFile | undefined;
  let currentHunk: ParsedDiffFile["hunks"][number] | undefined;
  let oldLineNum = 0;
  let newLineNum = 0;

  // `+++ b/` 之前的元数据要暂存，等目标路径出现后再创建文件对象。
  let pendingIsNew = false;
  let pendingIsDeleted = false;
  let pendingIsBinary = false;
  let pendingOldPath: string | undefined;
  let pendingNewPath: string | undefined; // from rename to

  function createPendingFile(path: string) {
    const file: ParsedDiffFile = {
      path,
      oldPath: pendingOldPath,
      isNew: pendingIsNew,
      isDeleted: pendingIsDeleted,
      isBinary: pendingIsBinary,
      insertions: 0,
      deletions: 0,
      hunks: []
    };
    files.push(file);
    currentFile = file;
    currentHunk = undefined;
    resetPending();
    return file;
  }

  function resetPending() {
    pendingIsNew = false;
    pendingIsDeleted = false;
    pendingIsBinary = false;
    pendingOldPath = undefined;
    pendingNewPath = undefined;
  }

  function flushPendingBinary() {
    // For binary files that have no +++ b/ line, create file from pending metadata
    if (pendingIsBinary || pendingOldPath) {
      const path = pendingNewPath ?? pendingOldPath ?? "unknown";
      createPendingFile(path);
    }
  }

  for (const line of lines) {
    // 新文件标记出现在 `--- /dev/null` 之前。
    if (line.startsWith("new file mode ")) {
      pendingIsNew = true;
      continue;
    }

    // Detect deleted file mode (appears before --- a/...)
    if (line.startsWith("deleted file mode ")) {
      pendingIsDeleted = true;
      continue;
    }

    // Detect binary files
    if (line.startsWith("Binary files ") && line.includes(" differ")) {
      if (currentFile) {
        currentFile.isBinary = true;
      } else {
        pendingIsBinary = true;
      }
      continue;
    }

    // Detect rename from (appears before +++ b/)
    if (line.startsWith("rename from ")) {
      pendingOldPath = line.slice(12);
      continue;
    }

    // Detect rename to
    if (line.startsWith("rename to ")) {
      pendingNewPath = line.slice(10);
      continue;
    }

    // --- a/file (old path)
    if (line.startsWith("--- a/")) {
      if (!pendingOldPath) {
        pendingOldPath = line.slice(6);
      }
      continue;
    }

    // --- /dev/null (new file marker)
    if (line === "--- /dev/null") {
      continue;
    }

    // +++ b/file (new path)
    if (line.startsWith("+++ b/")) {
      createPendingFile(line.slice(6));
      continue;
    }

    // +++ /dev/null (deleted file marker - use old path)
    if (line === "+++ /dev/null") {
      const path = pendingOldPath ?? pendingNewPath ?? "unknown";
      createPendingFile(path);
      continue;
    }

    const match = line.match(HUNK_RE);
    if (match && currentFile) {
      currentHunk = {
        oldStart: Number(match[1]),
        oldCount: Number(match[2] || "1"),
        newStart: Number(match[3]),
        newCount: Number(match[4] || "1"),
        lines: []
      };
      oldLineNum = currentHunk.oldStart;
      newLineNum = currentHunk.newStart;
      currentFile.hunks.push(currentHunk);
      continue;
    }

    if (currentHunk && currentFile) {
      if (line.startsWith("+")) {
        currentHunk.lines.push({
          type: "added",
          content: line.slice(1),
          oldLineNum: null,
          newLineNum: newLineNum++
        });
        currentFile.insertions++;
      } else if (line.startsWith("-")) {
        currentHunk.lines.push({
          type: "deleted",
          content: line.slice(1),
          oldLineNum: oldLineNum++,
          newLineNum: null
        });
        currentFile.deletions++;
      } else if (line.startsWith(" ") || line === "") {
        currentHunk.lines.push({
          type: "context",
          content: line.startsWith(" ") ? line.slice(1) : line,
          oldLineNum: oldLineNum++,
          newLineNum: newLineNum++
        });
      }
      // Lines like "\ No newline at end of file" are ignored
    }
  }

  // 二进制 diff 通常没有 hunk，循环结束时补齐暂存的文件元数据。
  flushPendingBinary();

  return files;
}
