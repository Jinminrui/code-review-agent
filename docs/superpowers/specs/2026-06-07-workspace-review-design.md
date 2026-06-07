# 设计：添加"审查当前工作区改动"功能

**日期：** 2026-06-07
**状态：** 已批准
**作者：** brainstorming session

## 背景

当前入口页面需要用户选择两个分支（基线分支和目标分支）才能发起 Code Review。用户希望能够直接审查当前工作区的所有未提交改动（暂存区 + 工区），而不需要选择分支。

## 目标

1. 在入口页面添加"审查当前改动"按钮
2. 用户选择仓库后，点击按钮即可审查所有未提交改动
3. 使用 `git diff HEAD` 获取差异
4. 保持现有分支选择功能不变

## 方案选择

### 考虑的方案

1. **方案 1：添加"快速审查"按钮**（已选择）
   - 在现有入口页面添加一个"审查当前改动"按钮，与分支选择并列
   - 优点：保持现有功能不变，实现简单，改动最小
   - 缺点：需要用户主动选择模式

2. **方案 2：默认"审查当前改动"模式**
   - 将"审查当前改动"作为默认模式，分支选择作为高级模式
   - 优点：更符合使用习惯，界面更简洁
   - 缺点：需要添加模式切换逻辑，增加 UI 复杂度

3. **方案 3：智能检测未提交改动**
   - 自动检测未提交改动，智能提示用户选择
   - 优点：智能化，减少用户操作
   - 缺点：需要额外的 Git 命令调用，逻辑相对复杂

### 选择理由

方案 1 实现简单，改动最小，同时保持了现有功能的完整性。用户可以快速选择：审查当前改动 vs 选择分支对比。

## 详细设计

### 1. UI 设计

在现有入口页面的右侧表单区域，在分支选择下方添加一个分隔线，然后是"审查当前改动"按钮。

```
┌─────────────────────────────────────┐
│ Review Setup                        │
│ 选择仓库与分支                       │
│                                     │
│ [仓库选择器]                         │
│ [基线分支]  [目标分支]                │
│                                     │
│ [开始 Code Review]                   │
│                                     │
│ ───────────── 或 ─────────────      │
│                                     │
│ [审查当前改动]  ← 新增按钮            │
└─────────────────────────────────────┘
```

**按钮样式：**
- 使用次要颜色（如灰色或浅蓝色）与主按钮区分
- 添加图标（如文件变更图标）
- 按钮文字："审查当前工作区改动"

### 2. 功能逻辑

**前端流程：**
1. 用户选择仓库
2. 点击"审查当前改动"按钮
3. 自动创建 Review Session，参数：
   - `repositoryPath`: 当前选择的仓库路径
   - `baseRef`: "HEAD"
   - `targetRef`: "WORKSPACE"
4. 跳转到 Review Session 页面

**后端逻辑：**
1. 在 `GitClient` 中添加新方法 `readWorkspaceDiff()`
2. 使用 `git diff HEAD` 获取所有未提交的改动
3. 在 `streamReviewSession` 中处理 "WORKSPACE" 模式

### 3. 后端修改

**GitClient 新增方法：**
```typescript
async readWorkspaceDiff(): Promise<ParsedDiffFile[]> {
  const { stdout } = await execa(
    "git",
    ["diff", "--no-ext-diff", "HEAD"],
    {
      cwd: this.repositoryPath,
      maxBuffer: 20_000_000
    }
  );
  return parseUnifiedDiff(stdout);
}
```

**ReviewSessionInput 修改：**
- 保持现有类型不变
- 当 `targetRef === "WORKSPACE"` 时，使用 `readWorkspaceDiff()` 而不是 `readDiff(baseRef, targetRef)`

**streamReviewSession 修改：**
```typescript
const diffFiles = input.input.targetRef === "WORKSPACE"
  ? await input.dependencies.gitClient.readWorkspaceDiff()
  : await input.dependencies.gitClient.readDiff(
      input.input.baseRef,
      input.input.targetRef
    );
```

### 4. 测试策略

- 测试"审查当前改动"按钮的渲染
- 测试点击按钮后创建 Session 的参数
- 测试 `readWorkspaceDiff()` 方法
- 测试 `streamReviewSession` 处理 WORKSPACE 模式

### 5. 实现步骤

1. **后端：** 添加 `readWorkspaceDiff()` 方法到 GitClient
2. **后端：** 修改 `streamReviewSession` 支持 WORKSPACE 模式
3. **前端：** 在 LaunchReviewForm 中添加"审查当前改动"按钮
4. **前端：** 添加按钮点击处理逻辑
5. **测试：** 添加相关测试用例

## 影响范围

- `packages/review-backend/src/infrastructure/git/git-client.ts` - 添加新方法
- `packages/review-backend/src/application/stream-review-session.ts` - 修改差异获取逻辑
- `packages/review-app/src/components/launch/launch-review-form.tsx` - 添加按钮和处理逻辑
- 相关测试文件

## 风险与缓解

1. **风险：** `git diff HEAD` 可能包含大量改动，导致性能问题
   - **缓解：** 保持现有的 `maxBuffer: 20_000_000` 设置

2. **风险：** 工作区可能没有未提交的改动
   - **缓解：** 在按钮点击时检查是否有改动，如果没有则显示提示

## 成功标准

1. 用户可以选择仓库，点击"审查当前改动"按钮
2. 系统使用 `git diff HEAD` 获取所有未提交的改动
3. 成功创建 Review Session 并跳转到工作台
4. 现有分支选择功能不受影响
