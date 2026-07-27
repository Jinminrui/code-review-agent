/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewTracePanel } from "../src/components/session/review-trace-panel";

describe("ReviewTracePanel", () => {
  it("only renders structured trace fields and marks missing fields unavailable", () => {
    render(<ReviewTracePanel trace={{ planSummary: "检查一个文件", toolSummaries: null, evidenceSources: ["file_read: 函数"], reflectionConclusion: "通过", degradation: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "审查轨迹" }));
    expect(screen.getByText("检查一个文件")).toBeInTheDocument();
    expect(screen.getByText("file_read: 函数")).toBeInTheDocument();
    expect(screen.getAllByText("不可用")).toHaveLength(1);
    expect(screen.queryByText(/完整 prompt/i)).not.toBeInTheDocument();
  });
});
