/**
 * 外部依赖实现过渡入口。
 * Git、LLM、文件存储和日志的真实实现暂保留在 review-backend/infrastructure，
 * 通过本 facade 先隔离 shell 的依赖方向，后续再按 adapter 逐个迁移。
 */
export {
  FileSessionStore,
  GitClient,
  OpenAiCompatibleProvider,
  resolveSessionsRoot
} from "@app/review-backend/infrastructure";
