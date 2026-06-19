# Desktop Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有 Electron 工程补齐正式桌面打包链路，首发生成可安装的 `macOS DMG`，同时为未来 `Windows` 打包保留清晰扩展位。

**Architecture:** 本计划保持现有 `review-shell + review-app + review-backend` 三层结构不变，只在桌面壳和 workspace 根层增加生产态资源加载、打包脚本和 `electron-builder` 配置。实现顺序先打通“无 dev server 启动 renderer”，再接入正式 `DMG` 打包，最后补齐资源、文档和验证。

**Tech Stack:** Electron、electron-builder、TypeScript 5、Node.js 22、pnpm workspace、Vite、Vitest

---

## Scope Check

这份计划只服务一个连续目标：让当前开发态 Electron 工程输出可安装的 `macOS DMG`。虽然会修改 `review-shell`、`review-app` 的构建产物消费方式和根目录脚本，但它们都围绕同一个桌面打包闭环，不需要拆成多个独立计划。

## File Structure Map

- Create: `electron-builder.json` — 桌面安装包集中配置，声明应用名、输出目录、平台目标和资源范围
- Create: `packages/review-shell/tests/packaged-entry.test.ts` — 生产态 renderer 入口路径解析测试
- Create: `assets/icons/mac/icon.icns` — macOS 应用图标占位与后续正式资源入口
- Modify: `package.json` — 增加桌面打包脚本与 `electron-builder` 依赖
- Modify: `packages/review-shell/src/runtime-config.ts` — 区分开发态 URL 与生产态本地入口
- Modify: `packages/review-shell/src/main.ts` — 按运行模式调用 `loadURL()` 或 `loadFile()`
- Modify: `packages/review-shell/tests/runtime-config.test.ts` — 覆盖开发态 / 生产态入口解析
- Modify: `packages/review-shell/package.json` — 增加桌面打包相关脚本或元信息
- Modify: `packages/review-app/package.json` — 如有必要补充稳定的构建输出约定
- Modify: `README.md` — 增加桌面打包与本地验证说明

## Implementation Notes

1. 运行时持久化目录继续使用 `app.getPath("userData")`，本计划不改变会话存储策略。
2. 计划不包含签名、公证和自动更新，只预留配置扩展位。
3. 受仓库协作约束影响，计划中的实现步骤不包含任何 git 提交操作；如后续需要提交，由你明确授权后再做。

### Task 1: 打通生产态 renderer 入口解析

**Files:**
- Create: `packages/review-shell/tests/packaged-entry.test.ts`
- Modify: `packages/review-shell/src/runtime-config.ts`
- Modify: `packages/review-shell/src/main.ts`
- Modify: `packages/review-shell/tests/runtime-config.test.ts`

- [ ] **Step 1: 先为生产态入口解析写失败测试**

```ts
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import {
  getPackagedRendererEntry,
  isRendererDevMode
} from "../src/runtime-config.js";

describe("packaged renderer entry", () => {
  it("treats REVIEW_RENDERER_URL as dev mode", () => {
    expect(
      isRendererDevMode({
        REVIEW_RENDERER_URL: "http://127.0.0.1:5173"
      })
    ).toBe(true);
  });

  it("resolves the built renderer index for packaged mode", () => {
    expect(getPackagedRendererEntry("/app/resources")).toBe(
      join("/app/resources", "review-app", "index.html")
    );
  });
});
```

- [ ] **Step 2: 运行测试并确认当前实现失败**

Run: `pnpm --filter @app/review-shell test -- runtime-config`
Expected: FAIL，提示 `isRendererDevMode` 或 `getPackagedRendererEntry` 未定义

- [ ] **Step 3: 在运行时配置中引入开发态 / 生产态分流**

```ts
import { join } from "node:path";

export function isRendererDevMode(env: Record<string, string | undefined>) {
  return Boolean(env.REVIEW_RENDERER_URL);
}

export function getRendererUrl(env: Record<string, string | undefined>) {
  return env.REVIEW_RENDERER_URL ?? "http://127.0.0.1:5173";
}

export function getPackagedRendererEntry(resourcesPath: string) {
  return join(resourcesPath, "review-app", "index.html");
}

export function getPreloadFilename() {
  return "preload.cjs";
}
```

- [ ] **Step 4: 扩展现有测试覆盖生产态入口**

```ts
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import {
  getPackagedRendererEntry,
  getPreloadFilename,
  getRendererUrl,
  isRendererDevMode
} from "../src/runtime-config.js";

describe("getRendererUrl", () => {
  it("uses the desktop dev default when env is empty", () => {
    expect(getRendererUrl({})).toBe("http://127.0.0.1:5173");
  });

  it("prefers REVIEW_RENDERER_URL when provided", () => {
    expect(
      getRendererUrl({
        REVIEW_RENDERER_URL: "http://127.0.0.1:4300"
      })
    ).toBe("http://127.0.0.1:4300");
  });

  it("detects packaged mode when REVIEW_RENDERER_URL is missing", () => {
    expect(isRendererDevMode({})).toBe(false);
  });

  it("resolves the packaged renderer entry under the resources root", () => {
    expect(getPackagedRendererEntry("/tmp/resources")).toBe(
      join("/tmp/resources", "review-app", "index.html")
    );
  });

  it("uses a CommonJS preload output filename", () => {
    expect(getPreloadFilename()).toBe("preload.cjs");
  });
});
```

- [ ] **Step 5: 在主进程中按运行模式选择 `loadURL()` 或 `loadFile()`**

```ts
import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import {
  getPackagedRendererEntry,
  getPreloadFilename,
  getRendererUrl,
  isRendererDevMode
} from "./runtime-config.js";

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    webPreferences: {
      preload: join(import.meta.dirname, getPreloadFilename()),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isRendererDevMode(process.env)) {
    await window.loadURL(getRendererUrl(process.env));
    return;
  }

  await window.loadFile(getPackagedRendererEntry(process.resourcesPath));
}
```

- [ ] **Step 6: 运行 shell 测试确认入口切换逻辑通过**

Run: `pnpm --filter @app/review-shell test`
Expected: PASS，包含 `runtime-config` 和生产态入口解析用例

### Task 2: 增加 workspace 级桌面打包脚本与 builder 配置

**Files:**
- Create: `electron-builder.json`
- Modify: `package.json`
- Modify: `packages/review-shell/package.json`
- Modify: `packages/review-app/package.json`

- [ ] **Step 1: 先为根脚本约定写出目标配置**

```json
{
  "scripts": {
    "build": "pnpm --filter @app/review-backend build && pnpm --filter @app/review-app build && pnpm --filter @app/review-shell build",
    "build:desktop": "pnpm build",
    "dist:mac": "pnpm build:desktop && electron-builder --config electron-builder.json --mac dmg",
    "test": "pnpm --filter @app/review-backend test && pnpm --filter @app/review-app test && pnpm --filter @app/review-shell test"
  }
}
```

- [ ] **Step 2: 加入 `electron-builder` 依赖并保持根编排**

```json
{
  "name": "code-review-agent",
  "private": true,
  "packageManager": "pnpm@11.5.2",
  "engines": {
    "node": ">=22 <23"
  },
  "scripts": {
    "build": "pnpm --filter @app/review-backend build && pnpm --filter @app/review-app build && pnpm --filter @app/review-shell build",
    "build:desktop": "pnpm build",
    "dev:web": "VITE_USE_MOCK_API=true pnpm --filter @app/review-app dev -- --host 127.0.0.1 --port 5173",
    "dev:desktop": "node scripts/dev-desktop.mjs",
    "dist:mac": "pnpm build:desktop && electron-builder --config electron-builder.json --mac dmg",
    "test": "pnpm --filter @app/review-backend test && pnpm --filter @app/review-app test && pnpm --filter @app/review-shell test",
    "test:watch": "pnpm --filter @app/review-app test",
    "typecheck": "tsc -b packages/review-backend packages/review-app packages/review-shell"
  },
  "devDependencies": {
    "electron-builder": "^24.13.3",
    "typescript": "^5.8.3",
    "vitest": "^3.1.4"
  }
}
```

- [ ] **Step 3: 新建集中式 `electron-builder` 配置**

```json
{
  "appId": "com.codex.reviewagent",
  "productName": "Code Review Agent",
  "directories": {
    "output": "dist-desktop"
  },
  "files": [
    "packages/review-shell/dist/**/*",
    "packages/review-backend/dist/**/*",
    "packages/review-shell/package.json"
  ],
  "extraResources": [
    {
      "from": "packages/review-app/dist",
      "to": "review-app"
    }
  ],
  "mac": {
    "target": [
      "dmg"
    ],
    "artifactName": "${productName}-${version}-${arch}.${ext}",
    "icon": "assets/icons/mac/icon.icns"
  },
  "win": {
    "target": [
      "nsis"
    ]
  }
}
```

- [ ] **Step 4: 保持 shell 入口与打包产物声明一致**

```json
{
  "name": "@app/review-shell",
  "private": true,
  "type": "module",
  "main": "dist/src/main.js",
  "scripts": {
    "build": "tsc -b",
    "dev": "electron dist/src/main.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@app/review-backend": "workspace:*",
    "electron": "^36.4.0"
  }
}
```

- [ ] **Step 5: 运行构建命令验证打包前置产物完整**

Run: `pnpm build:desktop`
Expected: PASS，生成 `packages/review-app/dist`、`packages/review-backend/dist`、`packages/review-shell/dist`

### Task 3: 增加 macOS 资源入口并验证 DMG 打包

**Files:**
- Create: `assets/icons/mac/icon.icns`
- Modify: `electron-builder.json`
- Modify: `README.md`

- [ ] **Step 1: 创建 macOS 图标资源入口**

```text
assets/
  icons/
    mac/
      icon.icns
```

说明：
这里先放入一个可被 `electron-builder` 正常读取的 `.icns` 文件，后续若需要品牌升级，只替换这一处资源即可，不改打包脚本和平台配置。

- [ ] **Step 2: 在 README 中补充桌面打包说明**

```md
## 桌面打包

本项目当前支持生成 `macOS DMG` 安装包。

常用命令：

```bash
pnpm build:desktop
pnpm dist:mac
```

说明：

1. `build:desktop` 先生成 `review-backend`、`review-app` 和 `review-shell` 的构建产物
2. `dist:mac` 在构建完成后调用 `electron-builder` 生成 `dmg`
3. 当前阶段只覆盖本地无签名打包，不包含 notarization
```

- [ ] **Step 3: 执行正式打包命令并确认产物生成**

Run: `pnpm dist:mac`
Expected: PASS，输出目录 `dist-desktop/` 下出现 `.dmg` 和对应 `.app` 产物

- [ ] **Step 4: 记录最小冒烟验证结果**

```md
### 本地冒烟验证

1. 双击生成的 `.dmg`
2. 将 `Code Review Agent.app` 拖入 Applications
3. 启动应用并确认首页正常渲染
4. 验证不启动 Vite dev server 时应用仍能打开
5. 发起一次本地审查，确认 renderer 与 IPC 没有因打包路径变化失效
```

### Task 4: 补齐多平台预留说明和发布边界

**Files:**
- Modify: `docs/superpowers/specs/2026-06-13-desktop-packaging-design.md`
- Modify: `README.md`
- Modify: `electron-builder.json`

- [ ] **Step 1: 在 builder 配置中显式保留 Windows 扩展位**

```json
{
  "mac": {
    "target": [
      "dmg"
    ],
    "icon": "assets/icons/mac/icon.icns"
  },
  "win": {
    "target": [
      "nsis"
    ]
  }
}
```

- [ ] **Step 2: 在 README 中明确当前发布边界**

```md
当前发布边界：

1. 首发只支持 `macOS DMG`
2. 配置中已为 `Windows` 预留目标，但暂未启用对应构建命令
3. 自动更新、签名和 notarization 不在本阶段范围内
```

- [ ] **Step 3: 运行最终回归检查**

Run: `pnpm typecheck && pnpm test`
Expected: PASS，桌面打包相关改动没有破坏现有主进程、前端和后端测试

## Self-Review

### Spec coverage

已覆盖 spec 的核心要求：

1. `macOS DMG` 首发目标：Task 2 和 Task 3
2. `electron-builder` 选型落地：Task 2
3. 开发态 / 生产态 renderer 分离：Task 1
4. 统一根脚本编排：Task 2
5. 为未来 `Windows` 预留扩展位：Task 4
6. 发布边界和验证标准：Task 3 和 Task 4

没有发现缺失的 spec 主要求。

### Placeholder scan

已检查本计划，未保留 `TODO`、`TBD`、`implement later` 一类占位词。需要人工补充的只有真实 `.icns` 资源文件本身，但其路径、用途和接入点已经明确，不属于计划缺口。

### Type consistency

本计划中的关键函数名和脚本名保持一致：

1. `isRendererDevMode`
2. `getPackagedRendererEntry`
3. `build:desktop`
4. `dist:mac`

后续实现应沿用这些命名，避免在执行阶段漂移。
