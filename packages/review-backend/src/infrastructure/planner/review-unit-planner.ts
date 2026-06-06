import type { ReviewUnit } from "../../domain/review-unit.js";
import type { ParsedDiffFile } from "../git/parse-unified-diff.js";

export function buildReviewUnits(files: ParsedDiffFile[]): ReviewUnit[] {
  return files.map((file, index) => ({
    id: `unit_${index + 1}`,
    primaryFile: file.path,
    files: [file.path],
    diffPaths: [file.path]
  }));
}
