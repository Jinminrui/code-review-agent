import { jsx as _jsx } from "react/jsx-runtime";
import { AppShell } from "@/components/layout/app-shell";
import { LaunchReviewForm } from "@/components/launch/launch-review-form";
export function ReviewLaunchPage() {
    return (_jsx(AppShell, { children: _jsx(LaunchReviewForm, {}) }));
}
