import { mkdtemp, readdir, readFile, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LogFileSink } from "../src/infrastructure/logging/log-file-sink.js";

async function makeTempDirectory() {
  return mkdtemp(join(tmpdir(), "review-log-sink-"));
}

describe("LogFileSink", () => {
  it("creates the directory and writes JSONL records", async () => {
    const directory = join(await makeTempDirectory(), "nested");
    const sink = new LogFileSink({
      directory,
      now: () => new Date("2026-07-26T12:00:00.000Z")
    });

    sink.write(JSON.stringify({ traceId: "trace-1", msg: "started" }));
    sink.end();

    const files = await readdir(directory);
    expect(files).toHaveLength(1);
    expect(await readFile(join(directory, files[0]!), "utf8")).toBe(
      '{"traceId":"trace-1","msg":"started"}\n'
    );
  });

  it("rolls the file when the configured size is exceeded", async () => {
    const directory = await makeTempDirectory();
    const sink = new LogFileSink({
      directory,
      maxBytes: 30,
      now: () => new Date("2026-07-26T12:00:00.000Z")
    });

    sink.write('{"msg":"first record"}');
    sink.write('{"msg":"second record"}');
    sink.end();

    const files = (await readdir(directory)).sort();
    expect(files).toEqual(["review-backend-2026-07-26.1.jsonl", "review-backend-2026-07-26.jsonl"]);
  });

  it("removes only expired log files", async () => {
    const directory = await makeTempDirectory();
    const expired = join(directory, "review-backend-2026-07-20.jsonl");
    const current = join(directory, "review-backend-2026-07-26.jsonl");
    await writeFile(expired, "expired\n");
    await writeFile(current, "current\n");
    const old = new Date("2026-07-20T12:00:00.000Z");
    await utimes(expired, old, old);

    const sink = new LogFileSink({
      directory,
      retentionDays: 3,
      now: () => new Date("2026-07-26T12:00:00.000Z")
    });
    sink.end();

    await expect(readFile(expired)).rejects.toThrow();
    await expect(readFile(current, "utf8")).resolves.toBe("current\n");
  });
});
