# 前端交互体验优化实施方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 renderer 从“终端模拟器式界面”优化为面向专业 Reviewer 的 IDE 风格代码审查工作台，使用户能在 5 分钟内判断改动风险并验证最高风险 finding。

**Architecture:** 保留现有 React 页面、Zustand 会话状态和 IPC 边界，不引入新的状态管理或后端服务。新增一个轻量的前端视图模型层负责 finding 排序、筛选和会话状态文案；页面负责编排，组件负责展示。视觉层通过现有 Tailwind/CSS token 统一调整，Diff 继续使用 Monaco。

**Tech Stack:** React 19、TypeScript 5、Zustand、React Router、Tailwind CSS、Monaco Diff Editor、Vitest、Testing Library、Playwright

---

## 1. 已确认的产品决策

### 用户与目标

- 主要用户是有经验的工程师 Reviewer。
- 首要任务是快速判断本次改动是否值得关注，并验证最高风险 finding。
- 目标窗口优先支持 1280×800 及以上；窄窗口通过折叠和分层降级，不追求移动端。

### 启动审查

- 首页主入口是“选择仓库并启动审查”。
- 默认主流程是 Base Ref 对 Target Ref 的分支比较。
- “审查当前工作区”保留为次要入口。
- 选择仓库后自动识别默认分支和当前分支，并提供交换分支操作。
- 开始前展示明确的比较说明。

### 审查会话

- finding 优先，进度只作为顶部轻量状态。
- trace 默认折叠。
- finding 按 high、medium、low 排序，同级按文件路径和起始行排序。
- 支持按严重级别和文件筛选。
- 不加入待处理、已确认、已忽略等用户处理状态。
- 不加入键盘快捷键和专门的无障碍优化项目，但保留基本可操作性。
- 区分审查中、完成且无 finding、部分完成和失败状态。

### Finding 与 Diff

- 右侧详情展示摘要、严重级别、解释、证据和建议。
- 默认使用并排 Diff，同时提供内联 Diff 切换。
- 明确展示“已定位到代码行”和“仅定位到文件”，不使用“已校验”这类可能误导的文案。
- 风险文件列表不再常驻，合并为 finding 列表的文件筛选入口。

### 历史会话

- 支持一键重跑。
- 重跑复用原仓库、Base Ref 和 Target Ref，通过已有 `createSession` 创建新会话，不覆盖旧会话。

### 视觉方向

- 保留专业的深色代码工作台氛围。
- 从终端模拟器调整为“专业 IDE 审查工作台”。
- 中性灰作为基础色，青色只用于选中、链接和进行中状态。
- 红色和橙色只表达真实风险。
- 等宽字体只用于代码、路径和分支名；产品信息使用易读的普通字体。
- 减少 `$ command` 标签、发光、缩放和装饰性终端效果。

## 2. 文件变更地图

### 新增

- `packages/review-app/src/lib/review-view-model.ts`：提供 finding 排序、筛选、会话状态文案和比较说明等纯函数。
- `packages/review-app/src/components/session/finding-filter.tsx`：严重级别、文件筛选控件。
- `packages/review-app/src/components/diff/diff-toolbar.tsx`：Diff 模式切换和文件级定位提示。
- `packages/review-app/tests/review-view-model.test.ts`：视图模型纯函数测试。
- `packages/review-app/tests/finding-filter.test.tsx`：筛选控件交互测试。
- `packages/review-app/tests/diff-toolbar.test.tsx`：Diff 工具栏交互测试。

### 修改

- `packages/review-app/src/styles/globals.css`：重设工作台色彩、边框、字体和状态 token。
- `packages/review-app/src/components/layout/app-shell.tsx`：支持桌面宽度降级和更清晰的主内容边界。
- `packages/review-app/src/components/layout/activity-bar.tsx`：降低装饰性，强化当前导航状态。
- `packages/review-app/src/components/launch/launch-review-form.tsx`：改为产品语言、自动分支选择、交换分支和比较预览。
- `packages/review-app/src/components/launch/branch-selector.tsx`：支持默认值、加载态和无分支状态。
- `packages/review-app/src/pages/review-launch-page.tsx`：承载新的启动页布局和次要工作区入口。
- `packages/review-app/src/pages/review-session-page.tsx`：重新排列会话区，移除常驻风险文件列表，加入筛选和响应式布局。
- `packages/review-app/src/components/session/sidebar-header.tsx`：统一终态和运行态文案。
- `packages/review-app/src/components/session/session-progress.tsx`：改为顶部轻量进度条。
- `packages/review-app/src/components/session/review-trace-panel.tsx`：默认折叠为次级信息。
- `packages/review-app/src/components/session/finding-list.tsx`：接入排序、筛选和状态空文案。
- `packages/review-app/src/components/session/finding-card.tsx`：展示新的定位可信度文案和更清晰的风险信息层级。
- `packages/review-app/src/components/session/review-summary-panel.tsx`：压缩为摘要指标条，避免挤压 finding。
- `packages/review-app/src/components/session/risk-file-list.tsx`：删除页面引用；仅在没有其他引用时删除文件。
- `packages/review-app/src/components/diff/monaco-diff-viewer.tsx`：展示完整 finding 详情，支持并排/内联模式和文件级降级。
- `packages/review-app/src/pages/session-history-page.tsx`：加入重跑入口、空状态和筛选后的信息层级。
- `packages/review-app/src/components/session/session-card.tsx`：展示创建时间、风险摘要和重跑操作。
- `packages/review-app/src/store/session-history-store.ts`：增加复用原参数创建新会话的动作。
- `packages/review-app/src/lib/ipc-client.ts`：确认重跑直接复用已有 `createSession`，只有类型检查要求时才做最小类型调整。

### 测试覆盖

- 修改现有 `packages/review-app/tests/review-launch-page.test.tsx`。
- 修改现有 `packages/review-app/tests/review-session-page.test.tsx`。
- 修改现有 `packages/review-app/tests/session-history-page.test.tsx`。
- 修改现有 `packages/review-app/tests/session-card.test.tsx`。
- 新增并排/内联模式、筛选、状态空文案和重跑交互测试。
- 更新 `packages/review-app/tests/app.e2e.spec.ts` 覆盖启动审查到 finding 定位的主流程。

## 3. 分阶段实施任务

### Task 1：建立新的视觉 token 与工作台基础布局

**目的：** 先统一颜色、字体、边框和面板层级，避免每个组件自行调整颜色。

**Files:**

- Modify: `packages/review-app/src/styles/globals.css`
- Modify: `packages/review-app/tailwind.config.ts`
- Modify: `packages/review-app/src/components/layout/app-shell.tsx`
- Modify: `packages/review-app/src/components/layout/activity-bar.tsx`
- Test: `packages/review-app/tests/app-shell.test.tsx`（如当前不存在则创建）

- [ ] **Step 1: 为新 token 写渲染断言**

测试必须确认应用根节点包含工作台背景类，活动栏当前路由具有可识别的 active 状态，不能只依赖颜色判断。

运行：`pnpm --filter @app/review-app test -- app-shell.test.tsx`

预期：测试先失败，因为断言依赖的新布局和 active 标识尚不存在。

- [ ] **Step 2: 更新全局 token**

定义背景、面板、浮层、边框、正文、次要文字、选中、进行中和风险色。保留深色模式，但移除大面积渐变和高频 glow。普通文本栈使用系统中文字体，代码内容继续使用等宽字体。

- [ ] **Step 3: 调整 AppShell 与 ActivityBar**

让活动栏成为稳定的窄导航区；主内容区允许页面自行控制滚动。当前 active 导航同时包含可读标签或 aria 状态，不改变路由和 IPC 边界。

- [ ] **Step 4: 运行组件测试与构建**

运行：`pnpm --filter @app/review-app test -- app-shell.test.tsx`

预期：PASS。

运行：`pnpm --filter @app/review-app build`

预期：PASS。

- [ ] **Step 5: 提交本阶段**

```bash
git add packages/review-app/src/styles/globals.css packages/review-app/tailwind.config.ts packages/review-app/src/components/layout packages/review-app/tests/app-shell.test.tsx
git commit -m "style(review-app): 调整审查工作台视觉基调"
```

### Task 2：优化启动审查流程

**目的：** 让用户从选择仓库到开始分支审查的路径更短、更明确，避免两个空分支下拉框让用户猜测下一步。

**Files:**

- Modify: `packages/review-app/src/components/launch/launch-review-form.tsx`
- Modify: `packages/review-app/src/components/launch/branch-selector.tsx`
- Modify: `packages/review-app/src/pages/review-launch-page.tsx`
- Modify: `packages/review-app/tests/review-launch-page.test.tsx`

- [ ] **Step 1: 写自动分支选择失败测试**

覆盖以下行为：仓库选择成功后请求分支；返回包含 `main` 和当前分支时自动填充；Base 与 Target 相同则开始按钮保持禁用；点击交换按钮会交换两个 ref；工作区审查仍然调用 `HEAD` 与 `WORKSPACE`。

运行：`pnpm --filter @app/review-app test -- review-launch-page.test.tsx`

预期：新增断言失败。

- [ ] **Step 2: 实现最小分支默认选择逻辑**

沿用现有 `listBranches` IPC。默认分支优先匹配 `main`、`master`，Target 优先使用当前分支字段（如果 IPC 尚未提供当前分支，则只自动填充 Base，Target 保持待选择）。不得在 renderer 中伪造当前分支名称。

- [ ] **Step 3: 增加交换分支和比较预览**

在两个选择器之间增加交换操作；当两个 ref 均有效且不相同时，显示：`将审查 target 相对 base 的改动`，并明确显示实际名称。工作区入口使用低强调次按钮，并解释其针对未提交改动。

- [ ] **Step 4: 替换终端模拟文案**

将 `repository`、`base-branch`、`target-branch`、`$ start-review` 等产品主文案改为中文；路径和 ref 值保留等宽字体。

- [ ] **Step 5: 运行测试与构建**

运行：`pnpm --filter @app/review-app test -- review-launch-page.test.tsx`

预期：PASS，且原有工作区审查测试仍通过。

运行：`pnpm --filter @app/review-app build`

预期：PASS。

### Task 3：建立 finding 视图模型、排序和筛选

**目的：** 将业务数据和展示顺序分离，确保流式追加结果不会破坏 Reviewer 的风险优先顺序。

**Files:**

- Create: `packages/review-app/src/lib/review-view-model.ts`
- Create: `packages/review-app/src/components/session/finding-filter.tsx`
- Modify: `packages/review-app/src/components/session/finding-list.tsx`
- Modify: `packages/review-app/src/components/session/finding-card.tsx`
- Modify: `packages/review-app/src/pages/review-session-page.tsx`
- Test: `packages/review-app/tests/review-view-model.test.ts`
- Test: `packages/review-app/tests/finding-filter.test.tsx`
- Modify: `packages/review-app/tests/review-session-page.test.tsx`

- [ ] **Step 1: 写纯函数失败测试**

测试 `sortFindings`：high 在 medium 前，medium 在 low 前；同级按文件路径和 `startLine` 升序；文件级 finding 排在同文件的行级 finding 后。测试 `filterFindings`：全部、严重级别和指定文件筛选均只返回匹配项。

- [ ] **Step 2: 实现纯视图模型函数**

函数签名固定为：

```ts
sortFindings(findings: ReviewFinding[]): ReviewFinding[]
filterFindings(findings: ReviewFinding[], filter: FindingFilter): ReviewFinding[]
getSessionEmptyState(status: ReviewSessionDetail["status"], findingCount: number): SessionEmptyState
getComparisonLabel(baseRef: string, targetRef: string): string
```

函数必须返回新数组，不修改 store 中的 finding 顺序。

- [ ] **Step 3: 实现筛选控件**

新增 `FindingFilter` 类型，包含 `severity: "all" | "high" | "medium" | "low"` 和 `file: string | "all"`。控件放在“审查问题”标题下方，展示当前过滤后数量；文件选项按风险数量降序排列。

- [ ] **Step 4: 接入列表和卡片**

`ReviewSessionPage` 保存筛选 UI 状态；`FindingList` 接收过滤后的列表或筛选值，但不得自行解析后端原始文本。卡片使用“已定位到代码行”或“仅定位到文件”，删除现有根据 `status` 推导“已校验”的展示逻辑。

- [ ] **Step 5: 移除常驻风险文件列表**

从 `ReviewSessionPage` 删除 `RiskFileList` 常驻区域。只有在确认没有其他引用后，才删除 `risk-file-list.tsx`；不要删除未由本次改动产生的其他废弃代码。

- [ ] **Step 6: 运行测试**

运行：`pnpm --filter @app/review-app test -- review-view-model.test.ts finding-filter.test.tsx review-session-page.test.tsx`

预期：PASS。

### Task 4：重排会话状态与空状态体验

**目的：** 让用户清楚知道审查是否还在运行、是否无风险、是否部分完成或失败。

**Files:**

- Modify: `packages/review-app/src/pages/review-session-page.tsx`
- Modify: `packages/review-app/src/components/session/session-progress.tsx`
- Modify: `packages/review-app/src/components/session/review-trace-panel.tsx`
- Modify: `packages/review-app/src/components/session/sidebar-header.tsx`
- Modify: `packages/review-app/src/components/session/diff-empty-state.tsx`
- Modify: `packages/review-app/tests/review-session-page.test.tsx`
- Modify: `packages/review-app/tests/session-progress.test.tsx`
- Modify: `packages/review-app/tests/review-trace-panel.test.tsx`

- [ ] **Step 1: 写四类状态测试**

分别验证：running 且无 finding 显示“正在分析变更”；finished 且无 finding 显示“未发现需要关注的问题”；partial 显示结果不完整提示；failed 显示审查未完成和重试入口。

- [ ] **Step 2: 将进度移动到会话顶部**

进度只展示状态、已完成文件数/总文件数（已有数据时）和当前阶段；不占用 finding 列表的主要高度。不能为了显示预计时间而在前端猜测后端耗时。

- [ ] **Step 3: 折叠 trace**

`ReviewTracePanel` 默认收起，标题显示“审查过程”；打开后展示现有 trace 数据。没有数据时显示“暂无过程详情”，而不是空白区域。

- [ ] **Step 4: 统一终态文案**

沿用项目术语：`已完成`、`部分完成`、`失败`、`已中止`。运行中按钮统一使用“中止审查”和“正在中止...”。

- [ ] **Step 5: 运行测试**

运行：`pnpm --filter @app/review-app test -- review-session-page.test.tsx session-progress.test.tsx review-trace-panel.test.tsx`

预期：PASS。

### Task 5：升级 finding 详情与 Diff 交互

**目的：** 让 Reviewer 在同一视野内理解问题、查看证据并验证前后代码。

**Files:**

- Create: `packages/review-app/src/components/diff/diff-toolbar.tsx`
- Modify: `packages/review-app/src/components/diff/monaco-diff-viewer.tsx`
- Modify: `packages/review-app/src/components/session/finding-card.tsx`
- Modify: `packages/review-app/src/pages/review-session-page.tsx`
- Create: `packages/review-app/tests/diff-toolbar.test.tsx`
- Modify: `packages/review-app/tests/monaco-diff-styles.test.ts`
- Modify: `packages/review-app/tests/review-session-page.test.tsx`

- [ ] **Step 1: 写 Diff 模式切换测试**

验证工具栏默认值为 `side-by-side`，点击内联按钮后调用状态更新，按钮的选中态可被测试识别；窗口降级逻辑只根据实际容器宽度或 CSS 响应式规则，不在代码中伪造屏幕宽度。

- [ ] **Step 2: 增加 Diff 工具栏**

工具栏包含当前文件路径、定位可信度文案和并排/内联切换。文件级 finding 显示“仅定位到文件”，行级 finding 显示“已定位到代码行”。

- [ ] **Step 3: 完整展示 finding 详情**

在 Diff 上方展示摘要、严重级别、解释、证据和建议。默认展开摘要、解释和证据，建议可折叠；缺失字段显示“暂无信息”，不得使用另一个字段冒充缺失内容。

- [ ] **Step 4: 设置 Monaco 默认模式**

把 `renderSideBySide` 默认值改为 `true`，通过工具栏状态切换为 `false`。保留只读、行号、定位和现有主题；定位失败时明确展示文件级提示，不创建伪造行号。

- [ ] **Step 5: 运行测试与构建**

运行：`pnpm --filter @app/review-app test -- diff-toolbar.test.tsx monaco-diff-styles.test.tsx review-session-page.test.tsx`

预期：PASS。

运行：`pnpm --filter @app/review-app build`

预期：PASS。

### Task 6：优化历史会话与一键重跑

**目的：** 让历史会话成为可回看的时间线，并能快速基于相同参数创建新审查会话。

**Files:**

- Modify: `packages/review-app/src/components/session/session-card.tsx`
- Modify: `packages/review-app/src/pages/session-history-page.tsx`
- Modify: `packages/review-app/src/store/session-history-store.ts`
- Modify: `packages/review-app/tests/session-card.test.tsx`
- Modify: `packages/review-app/tests/session-history-page.test.tsx`
- Modify: `packages/review-app/tests/app.e2e.spec.ts`

- [ ] **Step 1: 写重跑失败测试**

点击历史卡片“重新审查”后，验证 `ipcClient.createSession` 接收到原 `repositoryPath`、`baseRef` 和 `targetRef`，成功后导航到新 `sessionId`；旧卡片仍然存在。

- [ ] **Step 2: 在 store 中实现重跑动作**

新增 `rerunSession(sessionId: string): Promise<string>`：从当前 `sessions` 找到目标，调用 `ipcClient.createSession`，返回新会话 ID；找不到目标时设置已有错误状态，不创建空请求。

- [ ] **Step 3: 更新历史卡片信息层级**

将分支比较作为主标题；仓库路径、创建时间、状态、文件数、finding 数和 high 数作为次要信息；删除和导出保留为低强调操作；新增“重新审查”按钮。

- [ ] **Step 4: 处理历史空状态与加载状态**

空状态提供“开始一次审查”主入口；加载状态保留稳定骨架或明确文案；错误状态提供重试，不把错误文本隐藏在卡片列表末尾。

- [ ] **Step 5: 运行测试与 E2E**

运行：`pnpm --filter @app/review-app test -- session-card.test.tsx session-history-page.test.tsx`

预期：PASS。

运行：`pnpm --filter @app/review-app test:e2e -- app.e2e.spec.ts`

预期：主流程覆盖启动、流式结果、选中 finding 和重跑入口。

## 4. 跨阶段验收标准

### 主流程

- 用户可以从首页选择仓库。
- 分支列表加载时有明确加载态，加载失败时有可理解错误。
- Base Ref 和 Target Ref 可以自动填充、交换和手动修改。
- 开始前能看到明确的比较方向。
- 创建成功后进入对应会话页。

### 会话页

- 运行中不会把“暂无发现”误显示为完成结果。
- finding 出现后按 high、medium、low 排序。
- 严重级别和文件筛选不会修改 store 原始数据。
- 选中 finding 后，详情、证据和 Diff 同步更新。
- 行级与文件级定位有不同文案和视觉提示。
- 默认并排 Diff 可切换到内联 Diff。
- trace 默认折叠。
- partial、failed、cancelled 都有明确终态展示。

### 历史会话

- 历史按创建时间展示。
- 卡片能看出仓库、比较方向、状态和风险数量。
- 一键重跑创建新会话，不覆盖旧记录。
- 删除和导出仍可用。

### 响应式与视觉

- 1280×800 下 finding 和 Diff 均保持可读。
- 更窄窗口下 finding 侧栏可折叠或进入分层视图。
- 风险色只用于表达风险，青色只用于选中、链接和进行中状态。
- 页面主文案不再依赖 `$ command` 终端标签。
- 没有新增大型动画、虚拟列表或主题系统。

## 5. 验证命令

每个任务完成后先运行对应的单测；全部任务完成后运行：

```bash
pnpm typecheck
pnpm test
pnpm --filter @app/review-app build
pnpm --filter @app/review-app test:e2e
```

预期：所有命令退出码为 0；若 E2E 依赖 Electron 环境未就绪，必须记录具体阻塞原因，不得将未执行标记为通过。

## 6. 明确不做的事项

- 不增加 finding 的人工处理状态。
- 不增加键盘快捷键系统。
- 不增加 GitHub/GitLab PR 集成。
- 不增加自动评论或自动修复。
- 不增加本地模型支持。
- 不引入 SQLite、全局查询缓存或新的 UI 框架。
- 不在 renderer 中猜测当前分支、预计耗时、定位行号或缺失字段。

## 7. 自检结果

- 需求覆盖：启动流程对应 Task 2；finding 对应 Task 3；状态对应 Task 4；Diff 对应 Task 5；历史与重跑对应 Task 6；视觉与窗口适配对应 Task 1 和 Task 5。
- 架构边界：没有新增 renderer 到文件系统、git 或模型的直接访问；重跑复用已有 `createSession` IPC。
- YAGNI：明确排除处理状态、快捷键、无障碍专项目标、复杂动画、虚拟列表和新框架。
- 测试策略：纯函数先测排序和筛选，组件测试交互，E2E 验证主流程，最后执行全量 typecheck、test、build。
