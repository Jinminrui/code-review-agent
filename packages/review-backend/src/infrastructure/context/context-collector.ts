import type { GitClient } from "../git/git-client.js";

export async function collectUnitContext(input: {
  gitClient: Pick<GitClient, "readFileAtRef">;
  baseRef: string;
  targetRef: string;
  filePath: string;
}) {
  const [beforeContent, afterContent] = await Promise.all([
    input.gitClient.readFileAtRef(input.baseRef, input.filePath).catch(() => ""),
    input.gitClient.readFileAtRef(input.targetRef, input.filePath).catch(() => "")
  ]);

  return {
    filePath: input.filePath,
    beforeContent,
    afterContent
  };
}
