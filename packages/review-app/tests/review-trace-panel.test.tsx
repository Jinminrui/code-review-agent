import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewTracePanel } from "../src/components/session/review-trace-panel";

describe("ReviewTracePanel", () => {
  it("only renders structured trace fields and marks missing fields unavailable", () => {
    render(<ReviewTracePanel trace={{ planSummary: "检查一个文件", toolSummaries: null, evidenceSources: ["file_read: 函数"], reflectionConclusion: "通过", degradation: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "review-trace" }));
    expect(screen.getByText("检查一个文件")).toBeInTheDocument();
    expect(screen.getByText("file_read: 函数")).toBeInTheDocument();
    expect(screen.getAllByText("不可用")).toHaveLength(1);
    expect(screen.queryByText(/完整 prompt/i)).not.toBeInTheDocument();
  });
});
