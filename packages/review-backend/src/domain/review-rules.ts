/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { z } from "zod";

export const reviewFilterConfigSchema = z.object({
  extensionAllowlist: z.array(z.string()).default([
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".go", ".py", ".java", ".kt", ".rs", ".c", ".cpp", ".h", ".hpp",
    ".rb", ".php", ".swift", ".dart", ".lua", ".sh", ".bash",
    ".sql", ".graphql", ".proto",
    ".json", ".yaml", ".yml", ".toml", ".xml", ".html", ".css", ".scss",
    ".md", ".txt"
  ]),
  excludePatterns: z.array(z.string()).default([
    "**/node_modules/**",
    "**/vendor/**",
    "**/*.lock",
    "**/dist/**",
    "**/build/**",
    "**/*.min.js",
    "**/*.min.css",
    "**/*.bundle.js",
    "**/*.map"
  ]),
  excludeTestFiles: z.boolean().default(false)
});

export type ReviewFilterConfig = z.infer<typeof reviewFilterConfigSchema>;

export const DEFAULT_FILTER_CONFIG: ReviewFilterConfig = reviewFilterConfigSchema.parse({});
