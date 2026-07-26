/**
 * 模块职责：集中配置本模块的构建、测试或运行时装配规则。
 * 边界约束：配置变更必须与 workspace、TypeScript 和 Electron 的运行边界保持一致。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "app.e2e.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true
  },
  webServer: {
    command:
      "VITE_USE_MOCK_API=true pnpm build && VITE_USE_MOCK_API=true node ../../node_modules/.pnpm/vite@6.4.3_@types+node@22.19.19_jiti@1.21.7_tsx@4.22.4/node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173",
    port: 4173,
    reuseExistingServer: false
  }
});
