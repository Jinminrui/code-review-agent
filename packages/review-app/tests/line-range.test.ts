/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { describe, expect, it } from "vitest";
import { toLineRange } from "../src/components/diff/line-range";

describe("toLineRange", () => {
  it("uses file-level fallback when no startLine exists", () => {
    expect(toLineRange({ status: "file-level" })).toEqual({ startLine: 1, endLine: 1 });
  });
});
