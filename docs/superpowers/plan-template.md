# Implementation Plan 模板

所有实施计划文档应遵循以下模板结构。

## 模板

```markdown
# [功能名称] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [一句话描述本计划要达成的目标]

**Architecture:** [描述涉及的架构变更和模块关系]

**Tech Stack:** [列出涉及的技术栈]

---

## 成功标准

[列出 3-5 条可验证的成功标准，每条都应该是可测试的]

---

## File Structure

- Create: [新文件列表]
- Modify: [修改文件列表]
- Test: [测试文件列表]

---

### Task 1: [任务名称]

**Files:**
- [文件列表]

- [ ] **Step 1: 先写失败测试**

[测试代码]

- [ ] **Step 2: 运行测试确认失败**

Run: `[命令]`
Expected: FAIL，[预期失败原因]

- [ ] **Step 3: 实现最小代码**

[实现代码]

- [ ] **Step 4: 运行测试确认通过**

Run: `[命令]`
Expected: PASS

---

### Task N: 回归验证和收尾

**Files:**
- No source file changes beyond Tasks 1-(N-1).

- [ ] **Step 1: 运行全量测试**

Run: `pnpm test`
Expected: PASS。

- [ ] **Step 2: 运行类型检查**

Run: `pnpm typecheck`
Expected: PASS。

---

## Self-Review

### 1. Spec 覆盖检查

[列出本计划覆盖了设计文档中的哪些要求，哪些未覆盖及原因]

### 2. Placeholder 扫描

[确认无 TBD、TODO、implement later 等占位表达]

### 3. 类型一致性检查

[确认跨模块的类型定义保持一致]

### 4. 测试覆盖声明

[列出每个 Task 的测试覆盖范围]

---

## 执行前备注

[列出实现时需要注意的事项和已知取舍]
```

## Self-Review 说明

每个 plan 文档必须包含 `## Self-Review` 章节，包含以下四个子节：

### 1. Spec 覆盖检查

列出本计划覆盖了哪些设计文档要求，哪些未覆盖。未覆盖的内容说明原因（如"不属于本计划范围"）。

### 2. Placeholder 扫描

确认计划正文中没有保留未细化的占位表达：
- 无 `TBD`、`TODO`、`implement later`
- 无"写对应测试"这类没有给出具体测试代码的步骤
- 无"实现 XXX"这类没有给出具体实现的步骤

### 3. 类型一致性检查

确认跨模块的类型定义保持一致：
- 后端和前端的 schema 字段名、类型一致
- 同一概念在不同文件中的命名一致
- IPC 契约的请求/响应类型匹配

### 4. 测试覆盖声明

列出每个 Task 覆盖的测试场景：
- 正常路径
- 边界情况
- 错误处理
