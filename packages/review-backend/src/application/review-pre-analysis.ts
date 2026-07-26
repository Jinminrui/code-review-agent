/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { z } from "zod";
import type { ParsedDiffFile } from "../infrastructure/git/parse-unified-diff.js";

const fileChangeTypeSchema = z.enum(["added", "deleted", "renamed", "modified"]);
const sensitivePathCategorySchema = z.enum([
  "authentication",
  "authorization",
  "configuration",
  "database",
  "dependency",
  "deployment",
  "secret"
]);
const nonBlankPathSchema = z.string().refine((path) => path.trim().length > 0, {
  message: "路径不能为空"
});

export const reviewPreAnalysisSchema = z.object({
  files: z.array(
    z.object({
      path: nonBlankPathSchema,
      oldPath: nonBlankPathSchema.optional(),
      changeType: fileChangeTypeSchema,
      isBinary: z.boolean(),
      language: z.string().min(1),
      insertions: z.number().int().nonnegative(),
      deletions: z.number().int().nonnegative()
    })
  ),
  totals: z.object({
    filesChanged: z.number().int().nonnegative(),
    insertions: z.number().int().nonnegative(),
    deletions: z.number().int().nonnegative()
  }),
  sensitivePathHints: z.array(
    z.object({
      path: nonBlankPathSchema,
      categories: z.array(sensitivePathCategorySchema).min(1)
    })
  )
});

export type ReviewPreAnalysis = z.infer<typeof reviewPreAnalysisSchema>;
type FileChangeType = z.infer<typeof fileChangeTypeSchema>;
type SensitivePathCategory = z.infer<typeof sensitivePathCategorySchema>;

const LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
  ".c": "c",
  ".cc": "cpp",
  ".cpp": "cpp",
  ".cs": "csharp",
  ".css": "css",
  ".go": "go",
  ".graphql": "graphql",
  ".h": "c",
  ".hpp": "cpp",
  ".html": "html",
  ".java": "java",
  ".js": "javascript",
  ".json": "json",
  ".jsx": "javascript",
  ".kt": "kotlin",
  ".md": "markdown",
  ".mjs": "javascript",
  ".png": "image",
  ".proto": "protobuf",
  ".py": "python",
  ".rb": "ruby",
  ".rs": "rust",
  ".scss": "scss",
  ".sh": "shell",
  ".sql": "sql",
  ".svelte": "svelte",
  ".swift": "swift",
  ".toml": "toml",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".vue": "vue",
  ".yaml": "yaml",
  ".yml": "yaml"
};

const SENSITIVE_PATH_MATCHERS: ReadonlyArray<{
  category: SensitivePathCategory;
  matches: (path: string) => boolean;
}> = [
  {
    category: "authentication",
    matches: (path) => /(^|\/)(auth|authentication|oauth|sso)(\/|[._-])/.test(path)
  },
  {
    category: "authorization",
    matches: (path) =>
      /(^|\/)(acl|permissions?|rbac)(\/|[._-])/.test(path) ||
      (/(^|\/)(access|auth|authentication|authorization|security)(\/|[._-])/.test(path) &&
        /(^|\/)polic(y|ies)(\/|[._-])/.test(path))
  },
  {
    category: "configuration",
    matches: (path) =>
      /(^|\/)(config|configuration)(\/|[._-])/.test(path) ||
      /(^|\/)\.env(\.|$)/.test(path)
  },
  {
    category: "database",
    matches: (path) =>
      /(^|\/)(database|db)(\/|[._-])/.test(path) ||
      /(^|\/)(migrate|migrations?|sql)\//.test(path) ||
      /\.sql$/.test(path) ||
      /(^|\/)(?:[^/]+[._-])?migrations?(?:[._-]|$)/.test(path)
  },
  {
    category: "dependency",
    matches: (path) =>
      /(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|requirements\.txt|go\.mod|cargo\.toml|pom\.xml)$/.test(
        path
      )
  },
  {
    category: "deployment",
    matches: (path) =>
      /(^|\/)(\.github\/workflows|deploy|deployment|docker|k8s|terraform)(\/|[._-])/.test(path) ||
      /(^|\/)dockerfile(?:\.[^/]+)?$/.test(path)
  },
  {
    category: "secret",
    matches: (path) => /(^|\/)(credentials?|secrets?|private[-_.]?key)(\/|[._-])/.test(path)
  }
];

export function buildReviewPreAnalysis(diffFiles: readonly ParsedDiffFile[]): ReviewPreAnalysis {
  diffFiles.forEach(assertValidPaths);

  const files = [...diffFiles]
    .sort(compareDiffFiles)
    .map((file) => ({
      path: file.path,
      ...(file.oldPath !== undefined ? { oldPath: file.oldPath } : {}),
      changeType: getChangeType(file),
      isBinary: file.isBinary,
      language: detectLanguage(file.path),
      insertions: file.insertions,
      deletions: file.deletions
    }));

  const sensitivePathHints = files.flatMap((file) => {
    // 只检查当前变更路径；旧路径和仓库中的其他文件不参与分类。
    const normalizedPath = file.path.toLowerCase();
    const categories = SENSITIVE_PATH_MATCHERS.filter((matcher) =>
      matcher.matches(normalizedPath)
    ).map((matcher) => matcher.category);

    return categories.length > 0 ? [{ path: file.path, categories }] : [];
  });

  return reviewPreAnalysisSchema.parse({
    files,
    totals: {
      filesChanged: files.length,
      insertions: files.reduce((total, file) => total + file.insertions, 0),
      deletions: files.reduce((total, file) => total + file.deletions, 0)
    },
    sensitivePathHints
  });
}

function assertValidPaths(file: ParsedDiffFile): void {
  if (typeof file.path !== "string" || file.path.trim().length === 0) {
    throw new TypeError("变更文件路径不能为空");
  }
  if (
    file.oldPath !== undefined &&
    (typeof file.oldPath !== "string" || file.oldPath.trim().length === 0)
  ) {
    throw new TypeError("变更文件旧路径不能为空");
  }
}

function compareDiffFiles(left: ParsedDiffFile, right: ParsedDiffFile): number {
  if (left.path !== right.path) {
    return left.path < right.path ? -1 : 1;
  }

  const leftOldPath = left.oldPath ?? "";
  const rightOldPath = right.oldPath ?? "";
  return leftOldPath === rightOldPath ? 0 : leftOldPath < rightOldPath ? -1 : 1;
}

function getChangeType(file: ParsedDiffFile): FileChangeType {
  if (file.isNew) {
    return "added";
  }
  if (file.isDeleted) {
    return "deleted";
  }
  if (file.oldPath && file.oldPath !== file.path) {
    return "renamed";
  }
  return "modified";
}

function detectLanguage(path: string): string {
  const normalizedPath = path.toLowerCase();
  const fileName = normalizedPath.slice(normalizedPath.lastIndexOf("/") + 1);

  if (fileName === "dockerfile") {
    return "dockerfile";
  }

  const extensionIndex = fileName.lastIndexOf(".");
  if (extensionIndex < 0) {
    return "unknown";
  }

  return LANGUAGE_BY_EXTENSION[fileName.slice(extensionIndex)] ?? "unknown";
}
