# Prompt 工程文档

本目录记录项目中使用的 LLM prompt 的设计意图、版本历史和已知问题。

## 核心 Prompt 列表

| Prompt | 位置 | 用途 | 当前版本 |
|---|---|---|---|
| [System Prompt](system-prompt.md) | `stream-review-session.ts` | Agent 系统提示，定义审查角色和行为 | v1 |
| [Review Prompt](review-prompt.md) | `stream-review-session.ts` | 用户消息，提供 diff 和文件内容 | v1 |
| [Plan Prompt](plan-prompt.md) | `plan-generator.ts` | 审查计划生成提示 | v1 |

## Prompt 设计原则

1. **中文输出**：所有 prompt 要求 LLM 使用中文输出。
2. **结构化输出**：要求 JSON 格式输出，便于程序解析。
3. **角色明确**：明确告知 LLM 它的角色（代码审查专家）。
4. **任务具体**：列出具体的审查关注点（安全、性能、错误处理等）。
5. **工具使用**：告知 LLM 可用的工具及其用途。

## 已知限制

1. System Prompt 和 Review Prompt 是硬编码在代码中的，不支持运行时配置。
2. Plan Prompt 使用简单的模板替换（`{{diff}}`、`{{fileContent}}`），不支持条件逻辑。
3. 没有 A/B 测试机制，prompt 变更需要发版。

## 变更流程

修改 prompt 时：

1. 更新本目录下对应的 prompt 文档。
2. 记录变更原因和预期影响。
3. 运行相关测试确认输出格式兼容。
4. 如有破坏性变更（输出格式变化），同步更新 `normalizeProviderOutput`。
