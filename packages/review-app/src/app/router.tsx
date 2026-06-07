import { createHashRouter, RouterProvider } from "react-router-dom";
import { ReviewLaunchPage } from "@/pages/review-launch-page";
import { ReviewSessionPage } from "@/pages/review-session-page";
import { SessionHistoryPage } from "@/pages/session-history-page";

const router = createHashRouter([
  { path: "/", element: <ReviewLaunchPage /> },
  { path: "/sessions", element: <SessionHistoryPage /> },
  { path: "/sessions/:sessionId", element: <ReviewSessionPage /> }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
