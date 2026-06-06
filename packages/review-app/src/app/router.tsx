import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ReviewLaunchPage } from "@/pages/review-launch-page";
import { ReviewSessionPage } from "@/pages/review-session-page";
import { SettingsPage } from "@/pages/settings-page";

const router = createMemoryRouter([
  { path: "/", element: <ReviewLaunchPage /> },
  { path: "/sessions/:sessionId", element: <ReviewSessionPage /> },
  { path: "/settings", element: <SettingsPage /> }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
