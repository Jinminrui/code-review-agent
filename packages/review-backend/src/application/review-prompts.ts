/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import type { ParsedDiffFile } from "../infrastructure/git/parse-unified-diff.js";

export function buildSystemPrompt(filePath: string): string {
  return `你是一位资深代码审查专家。请仔细审查文件 "${filePath}" 的代码变更。

你的任务：
1. 分析 diff 中的潜在 bug、安全问题、性能问题和代码质量问题。
2. 需要时使用工具获取更多上下文（读取文件、搜索代码等）。
3. 使用 code_comment 工具提交发现的问题。
4. 审查完成后调用 task_done。

要求：
- 关注真实问题，不要纠结代码风格。
- 提供具体的行号引用和证据。
- 考虑边界情况和错误处理。
- 全面但避免误报。
- 所有输出必须使用中文。`;
}

export function buildReviewPrompt(input: {
  filePath: string;
  diff: string;
  beforeContent: string;
  afterContent: string;
}): string {
  return `请审查文件 "${input.filePath}" 的以下代码变更：

## Diff
\`\`\`diff
${input.diff}
\`\`\`

## 变更后的文件内容
\`\`\`
${input.afterContent.slice(0, 50000)}
\`\`\`

请审查这些变更并报告发现的问题。`;
}

export function buildDiffText(filePath: string, diffFiles: ParsedDiffFile[]): string {
  const file = diffFiles.find((f) => f.path === filePath);
  if (!file) return "";

  return file.hunks
    .map((h) => {
      const lines = h.lines.map((l) => {
        const prefix = l.type === "added" ? "+" : l.type === "deleted" ? "-" : " ";
        return prefix + l.content;
      });
      return `@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@\n${lines.join("\n")}`;
    })
    .join("\n");
}
