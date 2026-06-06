import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AppShell } from "@/components/layout/app-shell";
import { PrivacySettingsForm } from "@/components/settings/privacy-settings-form";
import { ProviderProfileForm } from "@/components/settings/provider-profile-form";
export function SettingsPage() {
    return (_jsx(AppShell, { children: _jsxs("div", { className: "mx-auto grid h-full max-w-4xl content-center gap-6 px-10 py-12", children: [_jsx(ProviderProfileForm, {}), _jsx(PrivacySettingsForm, {})] }) }));
}
