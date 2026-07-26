# TraceId Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为每次审查会话建立可持久化、可按 `traceId` 查询的结构化日志链路。

**Architecture:** 后端日志基础设施使用 `AsyncLocalStorage` 保存当前审查执行的 trace 上下文，Pino `mixin` 自动注入 `traceId`。控制台输出与 JSONL 文件输出分离，文件日志由可配置的滚动写入器管理；查询工具只读扫描日志文件并按 traceId 返回有限结果。Electron 主进程仅在启动时把应用日志目录注入日志配置，不让基础设施依赖 Electron。

**Tech Stack:** Node.js 22、TypeScript 5、Pino、Vitest、Electron、`node:async_hooks`、`node:fs`。

---

## 文件结构与职责

- Create: `packages/review-backend/src/infrastructure/logging/trace-context.ts` — traceId 生成和 AsyncLocalStorage 上下文。
- Create: `packages/review-backend/src/infrastructure/logging/log-file-sink.ts` — JSONL 文件写入、按日期/大小滚动和过期文件清理。
- Create: `packages/review-backend/src/infrastructure/logging/read-logs.ts` — 按 traceId 读取日志文件并限制返回数量。
- Modify: `packages/review-backend/src/infrastructure/logging/logger.ts` — 接入上下文、文件 sink、运行时配置和敏感字段过滤。
- Modify: `packages/review-backend/src/infrastructure/index.ts` — 导出日志配置和查询接口。
- Modify: `packages/review-backend/src/application/stream-review-session.ts` — 为每次 generator 执行创建并恢复同一 traceId。
- Modify: `apps/review-shell/src/main.ts` — 在创建窗口前注入 Electron 应用日志目录并完成日志初始化。
- Create: `packages/review-backend/tests/trace-context.test.ts` — traceId 格式、上下文隔离和异步继承测试。
- Create: `packages/review-backend/tests/log-file-sink.test.ts` — JSONL、滚动和过期清理测试。
- Create: `packages/review-backend/tests/read-logs.test.ts` — traceId 查询、历史文件、损坏行和上限测试。
- Create: `packages/review-backend/tests/logger.test.ts` — Pino 结构化日志字段和文件输出测试。
- Modify: `packages/review-backend/tests/stream-review-session.hybrid.test.ts` — 验证一次审查流使用单一 traceId 上下文。
- Create: `scripts/query-review-logs.ts` — 开发者命令行查询入口。
- Modify: `package.json` — 增加 `logs:find` 脚本。

### Task 1: 建立 traceId 异步上下文

**Files:**
- Create: `packages/review-backend/src/infrastructure/logging/trace-context.ts`
- Test: `packages/review-backend/tests/trace-context.test.ts`

- [ ] **Step 1: 写失败测试**

覆盖三个行为：`createTraceId()` 返回 UUID；`runWithTraceId()` 内部可读到指定 ID；并行 Promise 使用不同上下文时互不串值。

- [ ] **Step 2: 运行测试确认失败**

运行：`pnpm --filter @app/review-backend test tests/trace-context.test.ts`

预期：因 `trace-context.ts` 尚不存在而失败。

- [ ] **Step 3: 写最小实现**

使用 `AsyncLocalStorage<string>`；导出 `createTraceId(): string`、`getTraceId(): string | undefined` 和 `runWithTraceId<T>(traceId: string, callback: () => T): T`。traceId 使用 `randomUUID()`，不在上下文缺失时生成伪造值。

- [ ] **Step 4: 运行测试确认通过**

运行同一命令，预期全部通过。

- [ ] **Step 5: 提交**

```bash
git add packages/review-backend/src/infrastructure/logging/trace-context.ts packages/review-backend/tests/trace-context.test.ts
git commit -m "feat(logging): 增加 traceId 异步上下文"
```

### Task 2: 增加 JSONL 文件存储与滚动

**Files:**
- Create: `packages/review-backend/src/infrastructure/logging/log-file-sink.ts`
- Test: `packages/review-backend/tests/log-file-sink.test.ts`

- [ ] **Step 1: 写失败测试**

使用临时目录验证：写入内容为 JSONL；超过 `maxBytes` 后创建带序号的滚动文件；清理会删除过期日志但保留未过期日志；目录不存在时自动创建。

- [ ] **Step 2: 运行测试确认失败**

运行：`pnpm --filter @app/review-backend test tests/log-file-sink.test.ts`

预期：因 sink 尚不存在而失败。

- [ ] **Step 3: 写最小实现**

实现 `LogFileSink`，构造参数包含 `directory`、`baseName`、`maxBytes`、`retentionDays` 和可注入的 `now`。日志文件名使用日期和序号，写入前检查当前文件大小，超限后切换文件；初始化时创建目录并删除文件名符合自身前缀且超过保留期限的文件。每次写入只接受完整 JSON 字符串并补换行，不把 session 数据目录混入清理范围。

- [ ] **Step 4: 运行测试确认通过**

运行同一命令，预期全部通过。

- [ ] **Step 5: 提交**

```bash
git add packages/review-backend/src/infrastructure/logging/log-file-sink.ts packages/review-backend/tests/log-file-sink.test.ts
git commit -m "feat(logging): 增加 JSONL 日志滚动存储"
```

### Task 3: 接入 Pino 结构化输出和配置

**Files:**
- Modify: `packages/review-backend/src/infrastructure/logging/logger.ts`
- Create: `packages/review-backend/tests/logger.test.ts`
- Modify: `packages/review-backend/src/infrastructure/index.ts`

- [ ] **Step 1: 写失败测试**

将 logger 输出导向测试可读的内存 stream，验证上下文内日志包含给定 `traceId`，上下文外不包含伪造值；验证 `configureLogging({ directory })` 后日志写入 JSONL 文件；验证默认级别读取 `REVIEW_LOG_LEVEL`，并兼容旧的 `LOG_LEVEL`。

- [ ] **Step 2: 运行测试确认失败**

运行：`pnpm --filter @app/review-backend test tests/logger.test.ts`

预期：当前 logger 没有 trace mixin、运行时配置和文件输出能力。

- [ ] **Step 3: 写最小实现**

在 Pino 配置中加入 `mixin()`，从 `getTraceId()` 读取字段；保留开发环境 pretty 控制台输出。增加 `configureLogging(options)`，把 `LogFileSink` 作为独立目标接入，并使重复配置只复用或替换一次文件目标。配置解析只处理日志目录、级别、文件大小和保留天数，非法数值回退到默认值。

- [ ] **Step 4: 运行测试确认通过**

运行：`pnpm --filter @app/review-backend test tests/logger.test.ts`，然后运行 `pnpm --filter @app/review-backend test`。

- [ ] **Step 5: 提交**

```bash
git add packages/review-backend/src/infrastructure/logging/logger.ts packages/review-backend/src/infrastructure/index.ts packages/review-backend/tests/logger.test.ts
git commit -m "feat(logging): 接入 traceId 结构化文件日志"
```

### Task 4: 让审查流贯穿 traceId

**Files:**
- Modify: `packages/review-backend/src/application/stream-review-session.ts`
- Modify: `packages/review-backend/tests/stream-review-session.hybrid.test.ts`

- [ ] **Step 1: 写失败测试**

注入可捕获日志目标，执行一个最小 hybrid 审查流，断言审查流产生的日志都带同一个 UUID 格式的 traceId；恢复同一个 session 的第二次执行必须得到不同 traceId。

- [ ] **Step 2: 运行测试确认失败**

运行：`pnpm --filter @app/review-backend test tests/stream-review-session.hybrid.test.ts`

预期：日志缺少 traceId，或没有稳定的会话级上下文。

- [ ] **Step 3: 写最小实现**

将现有 generator 实现收进内部 generator；公共 `streamReviewSession` 为本次执行生成一个 traceId，并在每次调用内部 iterator 的 `next()` 时通过 `runWithTraceId(traceId, () => iterator.next())` 推进，再原样 yield 事件。不要把 traceId 加入现有 IPC/session contract，避免扩大 renderer 数据边界。

- [ ] **Step 4: 运行测试确认通过**

运行同一测试，再运行 `pnpm --filter @app/review-backend test`，预期全部通过。

- [ ] **Step 5: 提交**

```bash
git add packages/review-backend/src/application/stream-review-session.ts packages/review-backend/tests/stream-review-session.hybrid.test.ts
git commit -m "feat(logging): 贯穿审查会话 traceId"
```

### Task 5: 增加按 traceId 读取能力

**Files:**
- Create: `packages/review-backend/src/infrastructure/logging/read-logs.ts`
- Test: `packages/review-backend/tests/read-logs.test.ts`
- Modify: `packages/review-backend/src/infrastructure/index.ts`

- [ ] **Step 1: 写失败测试**

准备当前日志和历史滚动文件，验证查询按日期倒序扫描并返回匹配记录；坏 JSON 行被跳过；`limit` 截断结果；不存在目录返回空数组而不是抛错。

- [ ] **Step 2: 运行测试确认失败**

运行：`pnpm --filter @app/review-backend test tests/read-logs.test.ts`

预期：读取函数尚不存在而失败。

- [ ] **Step 3: 写最小实现**

导出 `readLogsByTraceId({ directory, traceId, limit })`。只读取自身日志前缀的文件，按文件修改时间倒序；逐行解析 JSON，匹配严格相等的 `traceId`，达到 limit 即停止。返回结构化日志对象，不回显未允许的敏感字段；损坏行通过可选诊断 logger 记录并继续。

- [ ] **Step 4: 运行测试确认通过**

运行：`pnpm --filter @app/review-backend test tests/read-logs.test.ts`，再运行后端全量测试。

- [ ] **Step 5: 提交**

```bash
git add packages/review-backend/src/infrastructure/logging/read-logs.ts packages/review-backend/src/infrastructure/index.ts packages/review-backend/tests/read-logs.test.ts
git commit -m "feat(logging): 支持按 traceId 查询日志"
```

### Task 6: 配置 Electron 日志目录和开发者命令

**Files:**
- Modify: `apps/review-shell/src/main.ts`
- Create: `scripts/query-review-logs.ts`
- Modify: `package.json`

- [ ] **Step 1: 写失败测试**

在 shell 现有测试中验证创建窗口前调用日志配置，且目录来自 Electron 的应用日志路径；为命令脚本增加参数缺失和查询成功的进程行为测试，查询结果输出 JSONL。

- [ ] **Step 2: 运行测试确认失败**

运行：`pnpm --filter @app/review-shell test`。

预期：当前主进程没有配置日志目录，查询命令不存在。

- [ ] **Step 3: 写最小实现**

在 `app.whenReady()` 后、创建窗口前调用 `configureLogging({ directory: app.getPath("logs") })`。在根 `package.json` 增加 `"logs:find": "tsx scripts/query-review-logs.ts"`；命令支持 `pnpm logs:find -- --trace-id <uuid> [--limit <n>] [--directory <path>]`，默认目录读取 `REVIEW_LOG_DIR`；复用 `readLogsByTraceId`，逐条输出 JSON，不把日志查询注册为 IPC。

- [ ] **Step 4: 运行测试确认通过**

运行 `pnpm --filter @app/review-shell test`、`pnpm logs:find -- --help`，然后执行 `pnpm typecheck`。

- [ ] **Step 5: 提交**

```bash
git add apps/review-shell/src/main.ts scripts/query-review-logs.ts package.json apps/review-shell/tests
git commit -m "feat(logging): 增加桌面日志目录与查询命令"
```

### Task 7: 全量验证与文档收尾

**Files:**
- Modify: `docs/superpowers/specs/2026-07-26-trace-id-logging-design.md` — 仅在实现细节与设计发生偏差时同步。
- Modify: `README.md` — 增加日志目录、环境变量和查询命令说明。

- [ ] **Step 1: 运行格式和类型检查**

运行：`git diff --check && pnpm typecheck`，预期无格式错误和 TypeScript 错误。

- [ ] **Step 2: 运行全量测试**

运行：`pnpm test`，预期 contracts、backend、app、shell 测试全部通过。

- [ ] **Step 3: 验证开发者查询路径**

使用临时日志目录写入一条带 traceId 的日志，运行 `pnpm logs:find -- --trace-id <同一ID> --directory <临时目录>`，预期输出匹配 JSONL；再验证不存在 traceId 时输出为空且进程成功退出。

- [ ] **Step 4: 更新 README**

只记录实际支持的配置项和命令，不新增应用内诊断页面说明。

- [ ] **Step 5: 提交**

```bash
git add README.md docs/superpowers/specs/2026-07-26-trace-id-logging-design.md
git commit -m "docs(logging): 补充日志使用说明"
```

## Self-review

- Spec coverage: traceId 上下文对应 Task 1/4；JSONL 存储、滚动和清理对应 Task 2/3；按 traceId 查询对应 Task 5/6；Electron 目录配置对应 Task 6；验证标准对应 Task 7。
- Placeholder scan: 计划没有 `TBD`、`TODO` 或未定义的接口名；每个代码步骤都给出了具体文件、函数和命令。
- Type consistency: `createTraceId`、`getTraceId`、`runWithTraceId`、`configureLogging` 和 `readLogsByTraceId` 在任务中使用一致；日志文件 sink 的配置字段在 Task 2/3 中一致。
