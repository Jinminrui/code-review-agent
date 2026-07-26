/**
 * 模块职责：从滚动 JSONL 日志中读取指定 traceId 的结构化记录。
 * 边界约束：只读取自身日志前缀，并只返回日志查询需要的安全字段。
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const LOG_FILE_PREFIX = "review-backend-";
const MAX_DEFAULT_RECORDS = 1000;
const SAFE_FIELDS = new Set([
  "level",
  "time",
  "pid",
  "hostname",
  "name",
  "msg",
  "traceId",
  "sid",
  "sessionId",
  "file",
  "component",
  "provider"
]);

export type ReviewLogRecord = Record<string, unknown>;

export async function readLogsByTraceId(input: {
  directory: string;
  traceId: string;
  limit?: number;
}): Promise<ReviewLogRecord[]> {
  const limit = Math.max(0, Math.min(input.limit ?? MAX_DEFAULT_RECORDS, MAX_DEFAULT_RECORDS));
  if (limit === 0) return [];

  let files: Array<{ path: string; mtimeMs: number }>;
  try {
    files = await listLogFiles(input.directory);
  } catch {
    return [];
  }

  const records: ReviewLogRecord[] = [];
  for (const file of files) {
    const contents = await readFile(file.path, "utf8");
    for (const line of contents.split("\n")) {
      if (!line.trim()) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (!isRecord(parsed) || parsed.traceId !== input.traceId) continue;
      records.push(pickSafeFields(parsed));
      if (records.length >= limit) return records;
    }
  }
  return records;
}

async function listLogFiles(directory: string): Promise<Array<{ path: string; mtimeMs: number }>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith(LOG_FILE_PREFIX) || !entry.name.endsWith(".jsonl")) continue;
    const path = join(directory, entry.name);
    files.push({ path, mtimeMs: (await stat(path)).mtimeMs });
  }
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickSafeFields(record: Record<string, unknown>): ReviewLogRecord {
  return Object.fromEntries(Object.entries(record).filter(([key]) => SAFE_FIELDS.has(key)));
}
