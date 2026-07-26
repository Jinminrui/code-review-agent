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
