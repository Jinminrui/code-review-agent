# Plan Prompt

## 位置

`packages/review-backend/src/infrastructure/llm/plan-generator.ts` → `PLAN_PROMPT`

## 当前版本

v1

## 内容

```
你是一位代码审查规划专家。分析以下 diff 并生成结构化的审查计划。

请用 JSON 格式响应：
{
  "riskPoints": [
    { "area": "风险区域描述", "riskLevel": "high|medium|low", "reasoning": "为什么有风险" }
  ],
  "reviewStrategy": "审查策略简述",
  "estimatedComplexity": "low|medium|high"
}

重点关注：
- 安全敏感变更（认证、输入校验、数据泄露）
- 错误处理缺失
- 性能问题
- 逻辑错误或边界情况
- 破坏性变更

所有字段必须使用中文。

Diff:
\`\`\`
${diff}
\`\`\`

变更后的文件内容:
\`\`\`
${fileContent}
\`\`\`
```

## 设计意图

- **规划导向**：将 LLM 定位为"规划专家"，先分析风险再制定审查策略。
- **结构化输出**：要求 JSON 格式，便于程序解析为 `ReviewPlan` 类型。
- **风险分类**：列出 5 个重点关注领域，引导 LLM 聚焦高价值问题。
- **模板替换**：使用 `{{diff}}` 和 `{{fileContent}}` 占位符，运行时替换。

## 变更历史

| 版本 | 日期 | 变更 |
|---|---|---|
| v1 | 2026-06-06 | 初始版本 |

## 已知问题

1. `diff` 和 `fileContent` 截断到 30000 字符，可能丢失重要上下文。
2. Plan 生成失败时静默返回默认计划，没有日志记录失败原因。
3. 生成的 `ReviewPlan` 目前只用于附加到 system prompt，对审查质量的影响未验证。
