/**
 * 模块职责：在 Electron 主进程启动时加载本地开发环境变量。
 * 边界约束：只读取项目根目录的 .env，不把环境变量暴露给 renderer。
 */
import dotenv from "dotenv";
import { resolve } from "node:path";

export function loadDotEnv(config: typeof dotenv.config = dotenv.config): void {
  config({ path: resolve(process.cwd(), ".env") });
}
