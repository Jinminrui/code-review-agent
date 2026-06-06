import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function AppShell({ children }) {
    return (_jsxs("div", { className: "grid h-full grid-cols-[260px_1fr] bg-[rgb(var(--bg))]", children: [_jsx("aside", { className: "border-r border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-4", children: _jsx("div", { className: "text-xs font-semibold uppercase tracking-[0.24em] text-[rgb(var(--muted))]", children: "Review Workbench" }) }), _jsx("main", { className: "min-w-0", children: children })] }));
}
