# Review Prompt

## 位置

`packages/review-backend/src/application/stream-review-session.ts` → `buildReviewPrompt()`

## 当前版本

v1

## 内容

```
请审查文件 "${filePath}" 的以下代码变更：

## Diff
\`\`\`diff
${diff}
\`\`\`

## 变更后的文件内容
\`\`\`
${afterContent.slice(0, 50000)}
\`\`\`

请审查这些变更并报告发现的问题。
```

## 设计意图

- **结构清晰**：使用 Markdown 标题分隔 diff 和文件内容，便于 LLM 识别。
- **上下文提供**：同时提供 diff（变更了什么）和完整文件内容（变更后的状态），帮助 LLM 理解上下文。
- **内容截断**：`afterContent` 限制在 50000 字符，防止超出 token 限制。

## 变更历史

| 版本 | 日期 | 变更 |
|---|---| ---|
| v1 | 2026-06-06 | 初始版本 |

## 已知问题

1. `diff` 和 `afterContent` 没有 token 级别的截断，大文件可能超出模型上下文窗口。
2. 没有提供 `beforeContent`（变更前内容），LLM 无法对比变更前后的差异。
3. `contextBudgetTokens` 参数虽然存在但未在此 prompt 中使用。
