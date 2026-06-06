export type ParsedDiffFile = {
  path: string;
  hunks: Array<{
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    lines: string[];
  }>;
};

const HUNK_RE = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/;

export function parseUnifiedDiff(input: string): ParsedDiffFile[] {
  const lines = input.split("\n");
  const files: ParsedDiffFile[] = [];
  let currentFile: ParsedDiffFile | undefined;
  let currentHunk: ParsedDiffFile["hunks"][number] | undefined;

  for (const line of lines) {
    if (line.startsWith("+++ b/")) {
      currentFile = { path: line.slice(6), hunks: [] };
      files.push(currentFile);
      currentHunk = undefined;
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
      currentFile.hunks.push(currentHunk);
      continue;
    }

    if (currentHunk) {
      currentHunk.lines.push(line);
    }
  }

  return files;
}
