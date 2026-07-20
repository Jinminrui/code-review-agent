# 选择 Electron 桌面架构而非 Web 应用

## 状态

已采纳

## 背景

项目需要读取用户本地 git 仓库的分支和 diff，这要求文件系统访问能力。可选方案包括：

1. Web 应用 + 本地 CLI 工具
2. Electron 桌面应用
3. 纯 CLI 工具

## 决策

采用 Electron + TypeScript 全栈架构。

## 原因

1. 需要直接访问本地文件系统和 git 仓库，Web 应用无法满足。
2. 需要可视化 diff 展示（Monaco Editor），纯 CLI 体验不足。
3. Electron 允许前后端共用 TypeScript，降低开发成本。
4. 本地运行，代码不需要上传到第三方服务器（LLM 调用除外）。

## 后果

- 需要处理 Electron 打包和分发。
- 需要 IPC 桥接前后端（preload.cts）。
- 应用体积较大。
