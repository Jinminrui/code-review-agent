# 导航栏和历史记录管理功能设计

**日期**：2026-06-09  
**状态**：已批准  
**作者**：Code Review Agent Team

## 概述

本设计文档描述了两个功能的实现方案：
1. **全局导航栏**：提供统一的页面导航入口
2. **历史记录管理**：查看、删除、导出审查历史记录

## 背景

当前应用存在以下问题：
- 审查结果页面没有返回首页的按钮
- 历史记录页面（`/sessions`）是空的，没有实际功能
- 用户无法管理已完成的审查记录

## 设计目标

1. 在应用顶部添加全局导航栏，包含"首页"和"历史记录"入口
2. 在审查结果页面侧边栏顶部添加返回首页按钮
3. 实现历史记录的查看、删除、导出功能
4. 保持与现有 UI 风格一致

---

## 第一部分：全局导航栏

### 组件结构

```
AppLayout
├── AppNavbar
│   ├── Logo + 应用标题
│   ├── 导航链接（首页、历史记录）
│   └── 当前页面高亮
└── 页面内容（children）
```

### 路由结构调整

```tsx
// router.tsx
const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <ReviewLaunchPage /> },
      { path: "sessions", element: <SessionHistoryPage /> },
      { path: "sessions/:sessionId", element: <ReviewSessionPage /> }
    ]
  }
]);
```

### AppNavbar 设计

**位置**：固定在页面顶部  
**高度**：48px（`h-12`）  
**背景**：`bg-bg-surface`  
**边框**：底部 `border-b border-border-default`

**导航项**：
- 使用 React Router 的 `NavLink` 组件
- Active 状态高亮：`text-accent-cyan` 或 `border-b-2 border-accent-cyan`
- Hover 状态：`hover:text-text-primary`

**布局**：
```
[Logo] [应用标题] -------- [首页] [历史记录]
```

---

## 第二部分：侧边栏返回按钮

### 组件结构

```
ReviewSessionPage
└── aside (侧边栏)
    ├── SidebarHeader (新增)
    │   ├── 返回首页按钮
    │   └── 会话状态
    ├── SessionProgress
    ├── ReviewSummaryPanel
    ├── RiskFileList
    └── FindingList
```

### SidebarHeader 设计

**位置**：侧边栏最顶部，`SessionProgress` 上方  
**高度**：约 48px  
**边框**：底部 `border-b border-border-default`

**内容**：
- **左侧**：返回按钮（`← 返回首页`）
- **右侧**：会话状态徽章

**交互**：
- 点击返回按钮：`navigate('/')` 跳转到首页
- 按钮样式：`ghost` 变体

**状态显示**：
- `idle`：不显示
- `running`：显示"审查中..."
- `finished`：显示"已完成"
- `failed`：显示"失败"

---

## 第三部分：历史记录管理

### 后端新增功能

#### 1. 删除会话

```typescript
// file-session-store.ts
async deleteSession(sessionId: string): Promise<void> {
  const sessionDir = join(this.rootDir, sessionId);
  await rm(sessionDir, { recursive: true, force: true });
}
```

#### 2. 导出 Markdown

```typescript
// file-session-store.ts
async exportSessionToMarkdown(sessionId: string): Promise<string> {
  const session = await this.getSession(sessionId);
  
  const lines: string[] = [];
  lines.push(`# 代码审查报告`);
  lines.push('');
  lines.push(`## 基本信息`);
  lines.push(`- **会话 ID**：${sessionId}`);
  lines.push(`- **仓库路径**：${session.repositoryPath}`);
  lines.push(`- **分支对比**：${session.baseRef} → ${session.targetRef}`);
  lines.push(`- **状态**：${session.status}`);
  lines.push('');
  lines.push(`## 审查摘要`);
  lines.push(`- **变更文件**：${session.summary.changedFilesCount} 个`);
  lines.push(`- **发现问题**：${session.summary.findingsCount} 个`);
  lines.push(`- **高风险**：${session.summary.highSeverityCount} 个`);
  lines.push('');
  lines.push(`## 问题列表`);
  
  for (const finding of session.findings) {
    lines.push(`### ${finding.title}`);
    lines.push(`- **文件**：${finding.file}`);
    lines.push(`- **严重程度**：${finding.severity}`);
    lines.push(`- **描述**：${finding.description}`);
    lines.push('');
  }
  
  return lines.join('\n');
}
```

### 前端新增功能

#### 1. SessionHistoryStore

```typescript
// store/session-history-store.ts
import { create } from 'zustand';
import type { SessionSummary } from '@/lib/review-model';

// SessionSummary 类型定义（需要在 lib/review-model.ts 中添加）
export type SessionSummary = {
  sessionId: string;
  repositoryPath: string;
  baseRef: string;
  targetRef: string;
  status: 'running' | 'finished' | 'failed';
  changedFilesCount: number;
  findingsCount: number;
  highSeverityCount: number;
  createdAt?: string;
};

type SessionHistoryStore = {
  sessions: SessionSummary[];
  isLoading: boolean;
  error: string | null;
  
  fetchSessions(): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  exportSession(sessionId: string): Promise<void>;
};

export const useSessionHistoryStore = create<SessionHistoryStore>((set, get) => ({
  sessions: [],
  isLoading: false,
  error: null,
  
  fetchSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const sessions = await listReviewSessions();
      set({ sessions, isLoading: false });
    } catch (error) {
      set({ error: '加载历史记录失败', isLoading: false });
    }
  },
  
  deleteSession: async (sessionId: string) => {
    try {
      await deleteReviewSession(sessionId);
      const sessions = get().sessions.filter(s => s.sessionId !== sessionId);
      set({ sessions });
    } catch (error) {
      set({ error: '删除会话失败' });
    }
  },
  
  exportSession: async (sessionId: string) => {
    try {
      const { markdown, filename } = await exportReviewSession(sessionId);
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      set({ error: '导出会话报告失败' });
    }
  },
}));
```

#### 2. SessionCard 组件

**内容展示**：
- 分支信息：`baseRef → targetRef`
- 仓库路径：缩略显示
- 时间：相对时间（如"2 小时前"）
- 状态：`StatusBadge` 组件
- 统计：文件数、发现数、高风险数

**操作按钮**：
- **查看详情**：点击整个卡片跳转
- **删除**：右侧 `Trash2` 图标，点击弹出确认对话框
- **导出**：右侧 `Download` 图标，点击触发下载

#### 3. 删除确认对话框

```
┌─────────────────────────────────────┐
│ 确认删除                            │
├─────────────────────────────────────┤
│ 确定要删除这条审查记录吗？          │
│ 此操作不可撤销。                    │
│                                     │
│           [取消]  [删除]            │
└─────────────────────────────────────┘
```

#### 4. 页面布局

```
SessionHistoryPage
├── 页面标题："审查历史"
├── 统计信息：共 N 条记录
├── SessionList
│   ├── SessionCard × N
│   │   ├── 基本信息
│   │   └── 操作按钮（删除、导出）
│   └── 空状态："暂无审查记录"
└── 分页（如果记录很多）
```

---

## 第四部分：IPC 契约和数据流

### 新增 IPC 契约

```typescript
// contracts/ipc.ts 新增

// 列出会话
export const listReviewSessionsRequestSchema = z.object({});
export const listReviewSessionsResponseSchema = z.array(
  z.object({
    sessionId: z.string(),
    repositoryPath: z.string(),
    baseRef: z.string(),
    targetRef: z.string(),
    status: z.enum(['running', 'finished', 'failed']),
    changedFilesCount: z.number(),
    findingsCount: z.number(),
    highSeverityCount: z.number(),
    createdAt: z.string().optional(),
  })
);

// 删除会话
export const deleteReviewSessionRequestSchema = z.object({
  sessionId: z.string(),
});

// 导出会话
export const exportReviewSessionRequestSchema = z.object({
  sessionId: z.string(),
});
export const exportReviewSessionResponseSchema = z.object({
  markdown: z.string(),
  filename: z.string(),
});
```

### IPC Handler 注册

```typescript
// review-shell/src/ipc-handlers.ts

// 列出会话
ipcMain.handle('review:listSessions', async () => {
  return sessionStore.listSessions();
});

// 删除会话
ipcMain.handle('review:deleteSession', async (_event, sessionId: string) => {
  await sessionStore.deleteSession(sessionId);
  return { success: true };
});

// 导出会话
ipcMain.handle('review:exportSession', async (_event, sessionId: string) => {
  const markdown = await sessionStore.exportSessionToMarkdown(sessionId);
  const filename = `review-${sessionId}.md`;
  return { markdown, filename };
});
```

### 前端 IPC Client

```typescript
// lib/ipc-client.ts 新增

export async function listReviewSessions(): Promise<SessionSummary[]> {
  return window.reviewWorkbenchApi.invoke('review:listSessions');
}

export async function deleteReviewSession(sessionId: string): Promise<void> {
  await window.reviewWorkbenchApi.invoke('review:deleteSession', sessionId);
}

export async function exportReviewSession(sessionId: string): Promise<{ markdown: string; filename: string }> {
  return window.reviewWorkbenchApi.invoke('review:exportSession', sessionId);
}
```

### 数据流

```
前端组件 → IPC Client → IPC Handler → FileSessionStore
    ↓                                        ↓
  状态更新 ←──── 响应数据 ←─────── 操作结果
```

---

## 第五部分：错误处理和测试策略

### 错误处理

#### 后端错误处理

**删除会话失败**：
- 会话不存在：抛出 `SessionNotFoundError`
- 文件系统权限错误：抛出 `FileSystemError`
- 返回统一错误格式：`{ error: string, code: string }`

**导出会话失败**：
- 会话不存在：抛出 `SessionNotFoundError`
- 数据损坏：抛出 `DataCorruptionError`

#### 前端错误处理

**IPC 调用失败**：
- 使用 `try-catch` 捕获错误
- 显示用户友好的错误提示（`Toast` 或 `Alert`）
- 记录错误日志

**错误提示**：
- 删除失败："删除失败：会话不存在或已被删除"
- 导出失败："导出会话报告失败，请稍后重试"
- 加载失败："加载历史记录失败，请检查网络连接"

### 测试策略

#### 后端单元测试

**FileSessionStore 测试**：
- `deleteSession()`：删除成功、会话不存在
- `exportSessionToMarkdown()`：正常导出、会话不存在

**IPC Handler 测试**：
- `review:listSessions`：返回正确列表
- `review:deleteSession`：删除成功、参数错误
- `review:exportSession`：导出成功、会话不存在

#### 前端组件测试

**AppNavbar 测试**：
- 渲染正确
- 导航链接高亮
- 点击跳转

**SidebarHeader 测试**：
- 渲染返回按钮
- 点击返回首页
- 状态显示正确

**SessionHistoryPage 测试**：
- 加载状态
- 空状态
- 列表渲染
- 删除操作
- 导出操作

**SessionCard 测试**：
- 信息展示
- 操作按钮
- 点击事件

#### 集成测试

**完整流程测试**：
- 启动审查 → 完成 → 返回首页
- 查看历史 → 删除记录
- 查看历史 → 导出报告

---

## 实现计划

### 阶段 1：后端功能（1-2 天）

1. 在 `FileSessionStore` 中添加 `deleteSession()` 方法
2. 在 `FileSessionStore` 中添加 `exportSessionToMarkdown()` 方法
3. 更新 IPC 契约
4. 注册 IPC Handler
5. 编写后端单元测试

### 阶段 2：前端导航（1 天）

1. 创建 `AppLayout` 组件
2. 创建 `AppNavbar` 组件
3. 调整路由结构
4. 创建 `SidebarHeader` 组件
5. 集成到 `ReviewSessionPage`
6. 编写前端组件测试

### 阶段 3：历史记录管理（2-3 天）

1. 创建 `SessionHistoryStore`
2. 创建 `SessionCard` 组件
3. 实现 `SessionHistoryPage`
4. 添加删除确认对话框
5. 实现导出功能
6. 编写前端组件测试

### 阶段 4：集成测试（1 天）

1. 端到端测试
2. 修复 bug
3. 优化用户体验

---

## 依赖关系

- 后端功能不依赖前端
- 前端导航不依赖历史记录功能
- 历史记录功能依赖后端功能

## 风险和缓解措施

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 文件系统权限问题 | 删除/导出失败 | 添加权限检查和友好错误提示 |
| 大量历史记录 | 页面加载慢 | 添加分页和虚拟滚动 |
| 数据损坏 | 导出失败 | 添加数据验证和错误恢复 |

---

## 总结

本设计通过组件化重构的方式，实现了全局导航栏和历史记录管理功能。设计遵循现有架构模式，复用已有代码，最小化改动风险。预计总开发时间为 5-7 天。
