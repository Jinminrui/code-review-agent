import type { ReviewUnit } from "../../domain/review-unit.js";
export declare function collectUnitContext(input: {
    baseRef: string;
    targetRef: string;
    unit: ReviewUnit;
}): Promise<{
    unitId: string;
    primaryFile: string;
    beforeContent: string;
    afterContent: string;
}>;
