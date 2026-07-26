/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
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
