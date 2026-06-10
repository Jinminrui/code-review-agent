# Code Review Agent — 技术面试总结

## 项目概述

**一句话介绍**：基于 Electron 的桌面端可视化代码审查工具，利用 LLM Agent 自动分析本地 Git 仓库的分支差异，生成结构化的风险问题卡片，支持 diff 定位跳转。

**核心价值**：将 LLM 驱动的代码审查能力封装为本地桌面工具，保护代码隐私（不上传到 GitHub/GitLab），同时提供可视化的审查体验。

---

## 1. 架构设计

### 1.1 三层 Monorepo 架构

```
┌─────────────────────────────────────────────────────────┐
│  review-shell (Electron 主进程)                          │
│  ├── 窗口管理、IPC Handler 注册                          │
│  ├── Preload 脚本（安全桥接）                            │
│  └── 调用 review-backend                                │
├─────────────────────────────────────────────────────────┤
│  review-app (React 前端渲染器)                           │
│  ├── 路由、组件、状态管理                                │
│  ├── Monaco Diff Editor                                 │
│  └── 通过 window.reviewWorkbenchApi 调用 IPC            │
├─────────────────────────────────────────────────────────┤
│  review-backend (审查引擎)                               │
│  ├── domain/ — 纯类型与 Zod Schema                      │
│  ├── application/ — 编排层（AsyncGenerator）             │
│  ├── infrastructure/ — Git、LLM、存储实现                │
│  └── contracts/ — IPC 契约                              │
└─────────────────────────────────────────────────────────┘
```

**面试要点**：
- **为什么用 Monorepo？** 三个包职责清晰，可独立测试，共享类型定义
- **为什么前后端隔离？** 前端不直接访问 git/文件系统，通过 IPC 通信，保证安全性
- **为什么用 AsyncGenerator？** 支持流式事件推送，实时反馈审查进度

### 1.2 领域驱动分层（后端）

| 层 | 职责 | 依赖 |
|---|---|---|
| `domain/` | 纯类型、Zod Schema | 无外部依赖 |
| `application/` | 业务编排 | 依赖 domain 接口 |
| `infrastructure/` | 具体实现 | 实现 domain 接口 |
| `contracts/` | IPC 契约 | 重新导出 domain schema |

**面试要点**：
- **依赖倒置**：`streamReviewSession` 接收 `provider`、`gitClient`、`sessionStore` 作为参数，不依赖全局状态
- **可测试性**：通过依赖注入，可以轻松 mock 任何外部依赖

---

## 2. 核心技术亮点

### 2.1 LLM Agent 模式（Tool-Use Loop）

```typescript
// 简化伪代码
async function* streamReviewSession(input) {
  const session = await sessionStore.createSession(input);
  yield { type: 'session-started', sessionId: session.sessionId };

  const diffFiles = await gitClient.readDiff(input.baseRef, input.targetRef);
  const units = buildReviewUnits(diffFiles);

  for (const unit of units) {
    try {
      const context = await collectContext(unit);
      const findings = await reviewWithAgent(unit, context, provider);
      yield { type: 'unit-completed', unitId: unit.id, findings };
    } catch (error) {
      yield { type: 'unit-failed', unitId: unit.id, error: error.message };
    }
  }

  yield { type: 'session-finished' };
}
```

**双路径 LLM 调用**：
- **Agent 模式**（支持 `chat()`）：最多 20 轮 tool-use loop，LLM 可自主调用 6 种工具
- **Single-shot 模式**（仅支持 `review()`）：单次调用，解析 JSON 响应

**6 种 Agent 工具**：
| 工具 | 功能 |
|------|------|
| `file_read` | 读取文件内容 |
| `file_find` | 搜索文件 |
| `code_search` | 代码搜索 |
| `code_comment` | 提交审查意见 |
| `file_read_diff` | 读取 diff |
| `task_done` | 结束审查 |

**面试要点**：
- **为什么用 Agent 模式？** LLM 可以自主探索代码仓库，发现更多上下文相关的风险
- **如何控制成本？** 对大 diff（>50 行）先生成审查计划，再针对性审查
- **如何处理失败？** 每个单元独立 try/catch，失败不影响其他单元

### 2.2 流式事件模型

```typescript
// 事件类型定义（Discriminated Union）
type ReviewSessionEvent =
  | { type: 'session-started'; sessionId: string }
  | { type: 'unit-completed'; unitId: string; findings: ReviewFinding[] }
  | { type: 'unit-failed'; unitId: string; error: string }
  | { type: 'session-finished' };
```

**数据流**：
```
前端 → IPC → 主进程 → AsyncGenerator → 事件流
                                        ↓
前端 ← webContents.send() ← 主进程广播
```

**面试要点**：
- **为什么用 AsyncGenerator？** 支持惰性求值、可中断、内存友好
- **如何保证事件不丢失？** 每个事件同时追加到 `events.jsonl` 文件
- **如何处理断线重连？** 前端先加载快照，再监听增量事件

### 2.3 行号重定位（Line Relocation）

```typescript
// 如果 LLM 返回的 finding 缺少行号
if (!finding.startLine) {
  const relocated = await relocateLine(finding, diffContext);
  if (relocated) {
    finding.startLine = relocated.startLine;
    finding.endLine = relocated.endLine;
    finding.status = 'line-level';
  } else {
    finding.status = 'file-level'; // 降级处理
  }
}
```

**面试要点**：
- **为什么需要重定位？** LLM 有时无法精确指出行号
- **如何降级？** 失败时标记为 `file-level`，不伪造行号
- **如何实现？** 通过 LLM 推断，结合 diff 上下文

### 2.4 文件过滤与审查单元拆分

```typescript
// 文件过滤规则
const filterConfig = {
  extensionAllowlist: ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', ...], // 30+ 种
  excludePatterns: ['**/node_modules/**', '**/dist/**', ...],
  excludeTestFiles: true
};
```

**面试要点**：
- **为什么过滤？** 避免审查二进制文件、生成代码、测试文件
- **如何拆分？** 当前实现为每个变更文件一个审查单元（1:1 映射）

---

## 3. 前端技术栈

### 3.1 状态管理（Zustand）

```typescript
// 审查会话 Store
const useReviewSessionStore = create<ReviewSessionStore>((set) => ({
  session: null,
  selectedFindingId: null,
  setSession: (session) => set({ session }),
  setSelectedFinding: (id) => set({ selectedFindingId: id })
}));

// 历史记录 Store
const useSessionHistoryStore = create<SessionHistoryStore>((set, get) => ({
  sessions: [],
  isLoading: false,
  error: null,
  fetchSessions: async () => { ... },
  deleteSession: async (id) => { ... },
  exportSession: async (id) => { ... }
}));
```

**面试要点**：
- **为什么用 Zustand 而不是 Redux？** 更轻量、API 简洁、无需 Provider
- **如何避免过度渲染？** 使用 selector 精确订阅状态片段

### 3.2 自定义 Hooks

| Hook | 功能 |
|------|------|
| `useReviewSessionStream` | 订阅会话事件流，实时更新状态 |
| `useSelectedFinding` | 派生当前选中的 finding |
| `useMonacoReveal` | 滚动 Monaco 到指定行并添加装饰 |

```typescript
// useReviewSessionStream 核心逻辑
export function useReviewSessionStream(sessionId: string) {
  const setSession = useReviewSessionStore((s) => s.setSession);

  useEffect(() => {
    // 1. 加载当前快照
    ipcClient.getSession(sessionId).then(setSession);

    // 2. 监听增量事件
    const unsubscribe = ipcClient.subscribeSession(sessionId, async () => {
      const updated = await ipcClient.getSession(sessionId);
      setSession(updated);
    });

    return unsubscribe;
  }, [sessionId, setSession]);
}
```

### 3.3 Monaco Editor 集成

```tsx
<MonacoDiffViewer
  original={selectedDiff?.original ?? ''}
  modified={selectedDiff?.modified ?? ''}
  finding={selectedFinding}
/>
```

**面试要点**：
- **为什么用 Monaco？** 支持语法高亮、行号定位、装饰器
- **如何定位到 finding？** 使用 `useMonacoReveal` hook，通过 `editor.revealLineInCenter` 滚动

### 3.4 设计系统

- **暗色主题**：基于 CSS 自定义属性（`bg-base`、`bg-surface`、`bg-elevated`）
- **Tailwind 集成**：将 CSS 变量映射为 utility class
- **自定义动画**：高风险脉冲、进度条发光、终端光标闪烁

---

## 4. Electron 安全架构

### 4.1 IPC 通信模型

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Renderer      │     │   Preload       │     │   Main Process  │
│   (React App)   │────▶│   (Bridge)      │────▶│   (Node.js)     │
│                 │     │                 │     │                 │
│ window.review   │     │ contextBridge   │     │ ipcMain.handle  │
│ WorkbenchApi    │     │ .exposeInMain   │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**安全配置**：
- `contextIsolation: true` — 渲染进程无法直接访问 Node.js API
- `nodeIntegration: false` — 禁用 Node.js 集成
- 所有 IPC 通信通过 `ipcRenderer.invoke()` 和 `ipcMain.handle()`

### 4.2 Preload 脚本

```typescript
// preload.cts (CommonJS 格式)
contextBridge.exposeInMainWorld("reviewWorkbenchApi", {
  listRepositories: () => ipcRenderer.invoke("review:listRepositories"),
  createSession: (input) => ipcRenderer.invoke("review:createSession", input),
  subscribeSession: (sessionId, onEvent) => {
    const channel = `review:session:${sessionId}`;
    const listener = (_event, payload) => onEvent(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});
```

---

## 5. 测试策略

### 5.1 测试金字塔

```
        ┌─────────────┐
        │   E2E (1)    │  Playwright
        ├─────────────┤
        │ 组件测试 (10) │  Testing Library
        ├─────────────┤
        │ 单元测试 (21) │  Vitest
        └─────────────┘
```

### 5.2 测试工具链

| 工具 | 用途 |
|------|------|
| Vitest 3.1.4 | 单元测试、组件测试 |
| @testing-library/react | React 组件测试 |
| @testing-library/jest-dom | DOM 断言 |
| jsdom | 浏览器环境模拟 |
| Playwright 1.53.0 | E2E 测试 |

### 5.3 Mock 策略

```typescript
// 前端 Mock API
if (import.meta.env.MODE === "test" || import.meta.env.VITE_USE_MOCK_API === "true") {
  ensureReviewWorkbenchApi(); // 注入 mock 实现到 window.reviewWorkbenchApi
}
```

**面试要点**：
- **如何测试 Electron 应用？** 前端通过 mock API 独立测试，无需启动 Electron
- **如何测试 LLM 集成？** 使用 mock provider，验证工具调用流程

---

## 6. 构建与开发

### 6.1 开发模式

| 命令 | 功能 |
|------|------|
| `pnpm dev:web` | 前端独立开发（Mock API） |
| `pnpm dev:desktop` | 完整 Electron 应用 |

### 6.2 构建管线

```
pnpm build
  ├── review-backend: tsc -b
  ├── review-app: tsc -b && vite build
  └── review-shell: tsc -b
```

### 6.3 关键依赖

| 依赖 | 用途 |
|------|------|
| `execa` | 执行 git 命令 |
| `pino` | 结构化日志 |
| `zod` | Schema 验证 |
| `monaco-editor` | 代码编辑器 |
| `zustand` | 状态管理 |
| `tailwindcss` | CSS 框架 |

---

## 7. 面试常见问题

### Q1: 为什么选择 Electron 而不是 Web 应用？

**A**: 
1. 需要访问本地文件系统和 git 命令
2. 保护代码隐私（不上传到云端）
3. 提供原生桌面体验（窗口管理、系统集成）

### Q2: 如何保证 LLM 返回的结果可靠？

**A**:
1. **结构化输出**：使用 Zod schema 验证 LLM 返回
2. **行号重定位**：对缺少行号的 finding 通过 LLM 推断精确位置
3. **优雅降级**：失败时标记为 `file-level`，不伪造数据
4. **错误隔离**：单个单元失败不影响整个会话

### Q3: 如何处理大文件的审查？

**A**:
1. **文件过滤**：跳过二进制文件、生成代码、测试文件
2. **审查计划**：对大 diff（>50 行）先生成计划，再针对性审查
3. **上下文预算**：通过 `contextBudgetTokens` 控制发送给 LLM 的内容量

### Q4: 前后端如何通信？

**A**:
1. 前端通过 `window.reviewWorkbenchApi` 调用 preload 脚本
2. Preload 通过 `ipcRenderer.invoke()` 调用主进程
3. 主进程通过 `ipcMain.handle()` 处理请求
4. 事件推送通过 `webContents.send()` 实现

### Q5: 如何保证代码质量？

**A**:
1. **TypeScript strict 模式**：`strict: true`、`noUncheckedIndexedAccess: true`
2. **Zod 运行时验证**：所有 IPC 数据通过 schema 验证
3. **TDD 开发**：先写测试，再写实现
4. **代码审查**：每个 PR 都经过 review

### Q6: 如何扩展新的审查规则？

**A**:
1. 在 `domain/review-rules.ts` 添加新的过滤规则
2. 在 `infrastructure/llm/tool-executors.ts` 添加新的工具
3. 在 `application/stream-review-session.ts` 修改审查逻辑

### Q7: 如何优化 LLM 调用成本？

**A**:
1. **文件过滤**：只审查相关文件
2. **上下文预算**：限制发送给 LLM 的内容量
3. **审查计划**：对大 diff 先生成计划，减少不必要的审查
4. **Single-shot 模式**：对简单场景使用单次调用

---

## 8. 项目亮点总结

1. **架构清晰**：三层 Monorepo，职责分离，易于维护
2. **类型安全**：端到端 TypeScript + Zod，编译时 + 运行时双重保障
3. **流式体验**：AsyncGenerator 实现流式事件推送，实时反馈进度
4. **Agent 模式**：LLM 可自主探索代码仓库，发现更多风险
5. **优雅降级**：行号定位失败降级为 file-level，单元失败隔离
6. **安全隔离**：Electron 安全配置，前端不直接访问 Node.js API
7. **测试完善**：单元测试 + 组件测试 + E2E 测试，覆盖核心功能
8. **开发体验**：Mock API 支持前端独立开发，热更新提升效率

---

## 9. 技术栈速查

| 类别 | 技术 |
|------|------|
| 运行时 | Node.js 22、Electron |
| 语言 | TypeScript 5（strict） |
| 前端 | React 19、Vite 6、React Router 7、Zustand 5、Tailwind 3、Monaco Editor |
| 后端 | Zod、execa、pino |
| 测试 | Vitest、Testing Library、Playwright |
| 包管理 | pnpm 11.5 workspace |
| 构建 | TypeScript project references、Vite |

---

*文档生成时间：2026-06-09*
