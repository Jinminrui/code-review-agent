import { mkdtemp, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readLogsByTraceId } from "../src/infrastructure/logging/read-logs.js";

async function makeTempDirectory() {
  return mkdtemp(join(tmpdir(), "review-log-read-"));
}

describe("readLogsByTraceId", () => {
  it("reads matching records from current and historical files", async () => {
    const directory = await makeTempDirectory();
    const current = join(directory, "review-backend-2026-07-26.jsonl");
    const history = join(directory, "review-backend-2026-07-25.1.jsonl");
    await writeFile(current, '{"traceId":"trace-1","msg":"current"}\n{"traceId":"other","msg":"skip"}\n');
    await writeFile(history, '{"traceId":"trace-1","msg":"history"}\n');
    const old = new Date("2026-07-25T12:00:00.000Z");
    await utimes(history, old, old);

    await expect(readLogsByTraceId({ directory, traceId: "trace-1" })).resolves.toEqual([
      { traceId: "trace-1", msg: "current" },
      { traceId: "trace-1", msg: "history" }
    ]);
  });

  it("skips malformed lines and stops at the limit", async () => {
    const directory = await makeTempDirectory();
    await writeFile(
      join(directory, "review-backend-2026-07-26.jsonl"),
      '{"traceId":"trace-1","msg":"first"}\nnot-json\n{"traceId":"trace-1","msg":"second"}\n'
    );

    await expect(readLogsByTraceId({ directory, traceId: "trace-1", limit: 1 })).resolves.toEqual([
      { traceId: "trace-1", msg: "first" }
    ]);
  });

  it("returns no records for a missing directory", async () => {
    const directory = join(await makeTempDirectory(), "missing");
    await expect(readLogsByTraceId({ directory, traceId: "trace-1" })).resolves.toEqual([]);
  });
});
