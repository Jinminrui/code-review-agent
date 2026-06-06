import type { ReviewUnit } from "../../domain/review-unit.js";
import type { ParsedDiffFile } from "../git/parse-unified-diff.js";
export declare function buildReviewUnits(files: ParsedDiffFile[]): ReviewUnit[];
