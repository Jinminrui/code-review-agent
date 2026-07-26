/**
 * 模块职责：集中配置本模块的构建、测试或运行时装配规则。
 * 边界约束：配置变更必须与 workspace、TypeScript 和 Electron 的运行边界保持一致。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@app/review-contracts": resolve(__dirname, "../review-contracts/src/index.ts")
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/app.e2e.spec.ts"]
  }
});
