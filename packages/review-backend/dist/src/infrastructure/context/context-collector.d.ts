import type { GitClient } from "../git/git-client.js";
import type { ReviewUnit } from "../../domain/review-unit.js";
export declare function collectUnitContext(input: {
    gitClient: Pick<GitClient, "readFileAtRef">;
    baseRef: string;
    targetRef: string;
    unit: ReviewUnit;
}): Promise<{
    unitId: string;
    primaryFile: string;
    beforeContent: string;
    afterContent: string;
}>;
