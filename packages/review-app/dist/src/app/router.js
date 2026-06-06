import { jsx as _jsx } from "react/jsx-runtime";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { ReviewLaunchPage } from "@/pages/review-launch-page";
import { ReviewSessionPage } from "@/pages/review-session-page";
import { SessionHistoryPage } from "@/pages/session-history-page";
import { SettingsPage } from "@/pages/settings-page";
const router = createHashRouter([
    { path: "/", element: _jsx(ReviewLaunchPage, {}) },
    { path: "/sessions", element: _jsx(SessionHistoryPage, {}) },
    { path: "/sessions/:sessionId", element: _jsx(ReviewSessionPage, {}) },
    { path: "/settings", element: _jsx(SettingsPage, {}) }
]);
export function AppRouter() {
    return _jsx(RouterProvider, { router: router });
}
