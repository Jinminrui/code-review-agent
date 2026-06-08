import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidebarHeader } from "../src/components/session/sidebar-header";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe("SidebarHeader", () => {
  afterEach(() => {
    cleanup();
    mockNavigate.mockClear();
  });

  it("renders back button and navigates to home on click", () => {
    render(
      <MemoryRouter>
        <SidebarHeader status="finished" />
      </MemoryRouter>
    );

    const backButton = screen.getByRole("button", { name: /返回首页/i });
    expect(backButton).toBeInTheDocument();

    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("displays session status", () => {
    render(
      <MemoryRouter>
        <SidebarHeader status="running" />
      </MemoryRouter>
    );

    expect(screen.getByText("审查中...")).toBeInTheDocument();
  });

  it("does not display status when idle", () => {
    render(
      <MemoryRouter>
        <SidebarHeader status="idle" />
      </MemoryRouter>
    );

    expect(screen.queryByText("审查中...")).not.toBeInTheDocument();
    expect(screen.queryByText("已完成")).not.toBeInTheDocument();
  });
});
