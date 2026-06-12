# Desktop Packaging Implementation Record

**日期**：2026-06-13
**状态**：完成
**关联设计文档**：`docs/superpowers/specs/2026-06-13-desktop-packaging-design.md`
**关联实现计划**：`docs/superpowers/plans/2026-06-13-desktop-packaging.md`

## 实现概述

本次实现为 `Code Review Agent` 补齐了桌面打包链路，首发支持生成 `macOS DMG` 安装包。核心改造包括：

1. 在 `review-shell` 中实现生产态 renderer 路径解析，支持 `app.isPackaged` 时通过 `loadFile()` 加载本地静态资源
2. 引入 `electron-builder`（`.yml` 配置）实现 DMG 打包
3. 新增 `build:desktop` 和 `dist:mac` 根脚本，打通构建到打包的完整链路
4. 通过 `build:desktop` 脚本将 `review-app` 构建产物拷贝到 `packages/review-shell/renderer/`

## 与设计文档的偏差

### 偏差 1：renderer 资源组织方式

- **设计文档建议**：将 `review-app` 构建产物通过 `extraResources` 打入 Electron 应用，运行时通过 `process.resourcesPath` 解析路径。
- **实际实现**：将 `review-app` 构建产物通过 `build:desktop` 脚本拷贝到 `packages/review-shell/renderer/`，并将其声明在 `electron-builder.yml` 的 `files` 字段中。运行时通过 `app.getAppPath()` 解析路径。
- **原因**：`files` 方式更简单直接，renderer 作为应用代码的一部分打包，路径解析更可控。`app.getAppPath()` 在 packaged 模式下指向应用根目录，配合 `renderer/index.html` 的相对路径即可正确定位。

### 偏差 2：配置文件格式

- **设计文档建议**：使用 `electron-builder.json` 作为集中配置文件。
- **实际实现**：使用 `electron-builder.yml` 作为配置文件。
- **原因**：YAML 格式更易读，且 `electron-builder` 原生支持。

### 偏差 3：输出目录

- **设计文档建议**：输出目录为 `dist-desktop`。
- **实际实现**：输出目录为 `release`。
- **原因**：`release` 是更常见的命名约定，与 `dist`（构建产物）形成区分。

### 偏差 4：runtime-config 职责拆分

- **设计文档建议**：在 `runtime-config.ts` 中集中实现 `isRendererDevMode`、`getRendererUrl`、`getPackagedRendererEntry` 等函数。
- **实际实现**：`runtime-config.ts` 仅保留 `getPreloadFilename()`，renderer 路径解析逻辑拆分到独立的 `paths.ts` 文件（`getRendererFilePath` 函数），以 `app.isPackaged` 作为判断条件。
- **原因**：职责更单一，`paths.ts` 专注于路径解析，`runtime-config.ts` 专注于运行时配置常量。

### 偏差 5：electron-builder 版本

- **设计文档建议**：`electron-builder` `^24.13.3`。
- **实际实现**：`electron-builder` `^26.15.3`。
- **原因**：使用最新稳定版本以获得更好的兼容性和功能支持。

## 待办事项

以下事项不在本次实现范围内，需后续跟进：

1. **macOS 签名与公证集成**：当前打包产物未签名，分发前需集成 Apple Developer 证书签名和 notarization 流程。
2. **Windows 安装包实现**：`electron-builder.yml` 中已预留 `win.target: nsis` 配置，但尚未实现对应构建命令和测试验证。
3. **CI 打包流水线接入**：需在 CI/CD 中集成 `pnpm dist:mac` 命令，实现自动化打包和产物归档。
4. **自动更新**：当前版本不支持自动更新，后续可考虑集成 `electron-updater`。
5. **应用图标正式化**：当前使用占位图标，需替换为正式品牌图标。

## 相关文件

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `electron-builder.yml` | 新增 | electron-builder 集中配置 |
| `package.json` | 修改 | 增加 `build:desktop`、`dist:mac` 脚本和 `electron-builder` 依赖 |
| `packages/review-shell/src/paths.ts` | 新增 | 生产态 renderer 路径解析 |
| `packages/review-shell/src/main.ts` | 修改 | 按 `app.isPackaged` 切换 `loadFile` / `loadURL` |
| `packages/review-shell/src/runtime-config.ts` | 修改 | 精简为仅保留 `getPreloadFilename` |
| `packages/review-shell/tests/paths.test.ts` | 新增 | renderer 路径解析测试 |
| `packages/review-shell/renderer/` | 新增目录 | 存放 `review-app` 构建产物（由 `build:desktop` 脚本生成） |
| `scripts/smoke-test-packaged.mjs` | 新增 | 桌面打包冒烟测试脚本 |
