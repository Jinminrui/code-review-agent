import type { ReviewFilterConfig } from "../../domain/review-rules.js";
import type { ParsedDiffFile } from "../git/parse-unified-diff.js";
import { logger } from "../logging/logger.js";

const log = logger.child({ component: "filter" });

export function filterReviewFiles(input: {
  files: ParsedDiffFile[];
  config: ReviewFilterConfig;
}): ParsedDiffFile[] {
  const { files, config } = input;
  const before = files.length;

  const filtered = files.filter((file) => {
    // Skip binary files
    if (file.isBinary) {
      log.debug(`跳过二进制文件: ${file.path}`);
      return false;
    }

    // Skip files not in extension allowlist
    const ext = getExtension(file.path);
    if (ext && !config.extensionAllowlist.includes(ext)) {
      log.debug(`跳过不在白名单的文件: ${file.path} (${ext})`);
      return false;
    }

    // Skip files matching exclude patterns
    if (matchesAnyPattern(file.path, config.excludePatterns)) {
      log.debug(`跳过排除模式匹配的文件: ${file.path}`);
      return false;
    }

    // Skip test files if configured
    if (config.excludeTestFiles && isTestFile(file.path)) {
      log.debug(`跳过测试文件: ${file.path}`);
      return false;
    }

    return true;
  });

  const skipped = before - filtered.length;
  if (skipped > 0) {
    log.info(`文件过滤: ${before} -> ${filtered.length} (跳过 ${skipped} 个)`);
  }

  return filtered;
}

function getExtension(path: string): string | null {
  const lastDot = path.lastIndexOf(".");
  if (lastDot === -1) return null;
  return path.slice(lastDot).toLowerCase();
}

function matchesAnyPattern(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchGlob(path, pattern));
}

function matchGlob(path: string, pattern: string): boolean {
  // Simple glob matching: ** matches any directory, * matches any filename chars
  const regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*")
    .replace(/\?/g, "[^/]");

  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(path);
}

function isTestFile(path: string): boolean {
  const testPatterns = [
    /\.test\./,
    /\.spec\./,
    /__tests__\//,
    /\/tests?\//,
    /\/test\//
  ];
  return testPatterns.some((p) => p.test(path));
}
