import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function RiskFileList({ files }) {
    return (_jsxs("section", { className: "grid gap-3 rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-4", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-[0.24em] text-[rgb(var(--muted))]", children: "Risk Files" }), _jsx("div", { className: "grid gap-2", children: files.map((file) => (_jsx("div", { className: "rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm text-[rgb(var(--ink))]", children: file }, file))) })] }));
}
