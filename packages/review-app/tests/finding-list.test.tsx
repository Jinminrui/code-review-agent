import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FindingList } from "../src/components/session/finding-list";

describe("FindingList", () => {
  it("calls onSelect when a finding is clicked", () => {
    const onSelect = vi.fn();

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
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /空值保护缺失/ }));
    expect(onSelect).toHaveBeenCalledWith("f_1");
  });
});
