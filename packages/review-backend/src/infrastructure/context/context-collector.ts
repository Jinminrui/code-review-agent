import type { ReviewUnit } from "../../domain/review-unit.js";

export async function collectUnitContext(input: {
  baseRef: string;
  targetRef: string;
  unit: ReviewUnit;
}) {
  return {
    unitId: input.unit.id,
    primaryFile: input.unit.primaryFile,
    beforeContent: `base:${input.baseRef}`,
    afterContent: `target:${input.targetRef}`
  };
}
