import type { ReviewFinding } from "../domain/review-finding.js";
import type { ParsedDiffFile } from "../infrastructure/git/parse-unified-diff.js";

export function normalizeFindingFiles(input: {
  findings: ReviewFinding[];
  primaryFile: string;
  diffFiles: ParsedDiffFile[];
  repositoryPath: string;
}): ReviewFinding[] {
  const knownFiles = new Set(input.diffFiles.map((file) => file.path));

  return input.findings.map((finding) => {
    const normalized = normalizeFindingFile({
      file: finding.file,
      primaryFile: input.primaryFile,
      repositoryPath: input.repositoryPath,
      knownFiles
    });

    return normalized === finding.file ? finding : { ...finding, file: normalized };
  });
}

function normalizeFindingFile(input: {
  file: string;
  primaryFile: string;
  repositoryPath: string;
  knownFiles: Set<string>;
}): string {
  const candidates = [
    input.file,
    input.file.replace(/^\.\//, ""),
    input.file.startsWith(`${input.repositoryPath}/`)
      ? input.file.slice(input.repositoryPath.length + 1)
      : input.file
  ];

  for (const candidate of candidates) {
    const clean = candidate.replace(/^\.\//, "");
    if (input.knownFiles.has(clean)) {
      return clean;
    }
  }

  if (!input.file || !input.knownFiles.has(input.file)) {
    return input.primaryFile;
  }

  return input.file;
}
