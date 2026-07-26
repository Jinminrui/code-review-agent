import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { configureLogging, logger } from "../src/infrastructure/logging/logger.js";
import { runWithTraceId } from "../src/infrastructure/logging/trace-context.js";

describe("logger", () => {
  it("writes the active traceId to JSONL logs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "review-logger-"));
    configureLogging({ directory, console: false });

    await runWithTraceId("trace-logger", async () => {
      logger.info({ component: "test" }, "日志开始");
    });
    logger.info("没有 trace 上下文");
    logger.flush();

    const file = (await readdir(directory)).find((entry) => entry.endsWith(".jsonl"));
    const records = (await readFile(join(directory, file!), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(records).toContainEqual(expect.objectContaining({ traceId: "trace-logger", msg: "日志开始" }));
    expect(records.find((record) => record.msg === "没有 trace 上下文")).not.toHaveProperty("traceId");
  });
});
