/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FindingList } from "../src/components/session/finding-list";

describe("FindingList", () => {
  it("calls onSelectFinding when a finding is clicked", () => {
    const onSelectFinding = vi.fn();

    render(
      <FindingList
        findings={[
          {
            id: "f_1",
            severity: "high",
            category: "bug-risk",
            summary: "空值保护缺失",
            explanation: "调用链可能传入 undefined",
            file: "src/a.ts",
            confidenceSignals: [],
            status: "file-level"
          }
        ]}
        selectedFindingId={null}
        onSelectFinding={onSelectFinding}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /空值保护缺失/ }));
    expect(onSelectFinding).toHaveBeenCalledWith("f_1");
  });

  it("shows finding card with summary text", () => {
    render(
      <FindingList
        findings={[
          {
            id: "f_1",
            severity: "high",
            category: "bug-risk",
            summary: "空值保护缺失",
            explanation: "调用链可能传入 undefined",
            file: "src/a.ts",
            confidenceSignals: [],
            status: "file-level"
          }
        ]}
        selectedFindingId={null}
        onSelectFinding={() => {}}
      />
    );

    expect(screen.getAllByText("空值保护缺失").length).toBeGreaterThan(0);
  });
});
