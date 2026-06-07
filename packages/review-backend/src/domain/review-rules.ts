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
