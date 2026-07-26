/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionProgress } from "../src/components/session/session-progress";

describe("SessionProgress", () => {
  it("shows the current phase, unit and degradation state", () => {
    render(<SessionProgress status="running" progress={{ phase: "validation", currentUnit: "unit:a", checks: [], budget: null, degradation: "证据不足", trace: { planSummary: null, toolSummaries: null, evidenceSources: [], reflectionConclusion: null, degradation: "证据不足" } }} />);
    expect(screen.getByText("校验")).toBeInTheDocument();
    expect(screen.getByText("unit:a")).toBeInTheDocument();
    expect(screen.getByText("证据不足")).toBeInTheDocument();
  });
});
