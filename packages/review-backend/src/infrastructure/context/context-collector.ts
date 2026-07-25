import type { GitClient } from "../git/git-client.js";

export async function collectUnitContext(input: {
  gitClient: Pick<GitClient, "readFileAtRef">;
  baseRef: string;
  targetRef: string;
  filePath: string;
}) {
  // 新增/删除文件在某一侧不存在是正常情况，用空字符串统一交给上层处理。
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
