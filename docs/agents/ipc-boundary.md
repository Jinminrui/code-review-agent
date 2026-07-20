# IPC 边界规范

本仓库的前端（renderer）和后端（main process）通过 IPC 通信。所有跨进程调用必须遵循以下规范。

## 架构

```
renderer (React)  →  preload.cts (bridge)  →  main process (Electron)  →  review-backend
                   window.reviewWorkbenchApi      IPC handler
```

## 核心规则

### 1. 前端不直接访问后端能力

前端只能通过 `window.reviewWorkbenchApi` 调用后端。禁止以下行为：

```ts
// ❌ 前端直接导入后端模块
import { GitClient } from "@app/review-backend";

// ❌ 前端直接调用 git
import { execa } from "execa";

// ❌ 前端直接读取文件
import { readFile } from "fs/promises";
```

```ts
// ✅ 通过 IPC 调用
const session = await window.reviewWorkbenchApi.createSession({ ... });
```

### 2. 前端只消费结构化结果

前端不处理 LLM 原始文本、git 原始输出或内部错误详情。所有数据经过 zod schema 校验后才传递给前端。

### 3. IPC 契约使用 zod schema

所有 IPC 请求和响应必须定义在 `packages/review-backend/src/contracts/` 中，使用 zod schema：

```ts
// contracts/ipc.ts
export const createReviewSessionRequestSchema = reviewSessionInputSchema;
export type CreateReviewSessionRequest = z.infer<typeof createReviewSessionRequestSchema>;
```

### 4. 前后端 schema 必须一致

前端在 `packages/review-app/src/lib/review-model.ts` 中定义自己的 zod schema，必须与后端保持结构一致。修改后端 schema 时必须同步修改前端。

## 数据流

### 请求流

```
用户操作 → React 组件 → useMutation hook → window.reviewWorkbenchApi.createSession()
→ preload.cts 转发 → main process IPC handler → streamReviewSession()
```

### 流式响应流

```
streamReviewSession() (AsyncGenerator)
→ main process 消费 generator
→ webContents.send("review:event", event) 推送给 renderer
→ renderer 通过 window.reviewWorkbenchApi.subscribeSession() 接收
→ useReviewSessionStream hook 更新 Zustand store
→ React 组件重新渲染
```

## 新增 IPC 接口的流程

1. 在后端 `contracts/ipc.ts` 定义请求/响应 schema。
2. 在后端 `application/` 实现业务逻辑。
3. 在 `review-shell` 注册 IPC handler。
4. 在 `preload.cts` 暴露 API 方法。
5. 在前端 `lib/ipc-client.ts` 添加调用方法。
6. 前后端同步编写测试。

## 禁止事项

- 不要在前端代码中 import 后端 `packages/review-backend` 的模块。
- 不要在 IPC 传输中暴露内部错误堆栈。
- 不要绕过 preload 直接使用 `ipcRenderer`。
