import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SettingsPage } from "../src/pages/settings-page";

describe("SettingsPage", () => {
  it("explains what data will be sent to the provider", () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByText("会发送到模型的内容")).toBeInTheDocument();
  });
});
