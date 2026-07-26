/**
 * 开发者工具：按 traceId 查询桌面端后端 JSONL 日志。
 */
import { readLogsByTraceId } from "../packages/review-backend/src/infrastructure/logging/read-logs.ts";

const args = process.argv.slice(2);

async function main(): Promise<void> {
  if (args.includes("--help")) {
    console.log("用法: pnpm logs:find -- --trace-id <uuid> [--limit <n>] [--directory <path>]");
    return;
  }

  const traceId = readOption("--trace-id");
  if (!traceId) {
    console.error("缺少必填参数: --trace-id <uuid>");
    process.exitCode = 1;
    return;
  }

  const records = await readLogsByTraceId({
    directory: readOption("--directory") ?? process.env.REVIEW_LOG_DIR ?? "logs",
    traceId,
    limit: parseLimit(readOption("--limit"))
  });

  for (const record of records) {
    console.log(JSON.stringify(record));
  }
}

function readOption(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseLimit(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const limit = Number(value);
  return Number.isInteger(limit) && limit > 0 ? limit : undefined;
}

void main();
