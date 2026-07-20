# 使用文件系统存储会话而非数据库

## 状态

已采纳

## 背景

审查会话需要持久化保存，以便用户回看历史审查结果。可选方案包括：

1. SQLite
2. 文件系统（JSON + JSONL）
3. IndexedDB（前端存储）

## 决策

使用文件系统存储：每个 session 一个目录，包含 `session.json`（元数据）、`events.jsonl`（事件流）、`summary.json`（最终结果）。

## 原因

1. 避免 Electron 打包期的原生模块复杂度（SQLite 需要 better-sqlite3 等原生依赖）。
2. JSON/JSONL 格式可读性强，便于调试。
3. MVP 阶段数据量小，文件系统性能足够。
4. 不引入额外数据库运维负担。

## 后果

- 不适合存储大量历史会话（文件系统 I/O 会成为瓶颈）。
- 不支持复杂查询（如按严重级别筛选跨 session 的 findings）。
- 后续如需扩展，可迁移到 SQLite，需重写 SessionStore 接口实现。
