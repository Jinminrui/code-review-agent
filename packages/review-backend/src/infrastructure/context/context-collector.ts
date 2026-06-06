import type { GitClient } from "../git/git-client.js";
import type { ReviewUnit } from "../../domain/review-unit.js";

export async function collectUnitContext(input: {
  gitClient: Pick<GitClient, "readFileAtRef">;
  baseRef: string;
  targetRef: string;
  unit: ReviewUnit;
}) {
  const [beforeContent, afterContent] = await Promise.all([
    input.gitClient.readFileAtRef(input.baseRef, input.unit.primaryFile).catch(() => ""),
    input.gitClient.readFileAtRef(input.targetRef, input.unit.primaryFile).catch(() => "")
  ]);

  return {
    unitId: input.unit.id,
    primaryFile: input.unit.primaryFile,
    beforeContent,
    afterContent
  };
}
