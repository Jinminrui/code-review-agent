import { describe, expect, it } from "vitest";
import { createTraceId, getTraceId, runWithTraceId } from "../src/infrastructure/logging/trace-context.js";

describe("trace context", () => {
  it("generates a UUID traceId", () => {
    expect(createTraceId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps the traceId available across async work", async () => {
    await runWithTraceId("trace-parent", async () => {
      await Promise.resolve();
      expect(getTraceId()).toBe("trace-parent");
    });

    expect(getTraceId()).toBeUndefined();
  });

  it("isolates concurrent trace contexts", async () => {
    const values = await Promise.all([
      runWithTraceId("trace-a", async () => {
        await Promise.resolve();
        return getTraceId();
      }),
      runWithTraceId("trace-b", async () => {
        await Promise.resolve();
        return getTraceId();
      })
    ]);

    expect(values).toEqual(["trace-a", "trace-b"]);
  });
});
