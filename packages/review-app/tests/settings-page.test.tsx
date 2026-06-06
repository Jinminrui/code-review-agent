import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SettingsPage } from "../src/pages/settings-page";

describe("SettingsPage", () => {
  it("explains what data will be sent to the provider", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByText("设置")[0]).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "模型与 Privacy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "模型服务配置" })).toBeInTheDocument();
    expect(screen.getByText("会发送到模型的内容")).toBeInTheDocument();
  });
});
