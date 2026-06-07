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
