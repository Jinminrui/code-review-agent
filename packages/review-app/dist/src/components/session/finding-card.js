import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { severityTone } from "@/lib/severity";
export function FindingCard({ finding, active, onSelect }) {
    return (_jsxs("button", { type: "button", className: `grid gap-2 rounded-[26px] border p-4 text-left transition ${severityTone[finding.severity]} ${active ? "ring-2 ring-[rgb(var(--accent))]" : ""}`, onClick: () => onSelect(finding.id), children: [_jsxs("div", { className: "flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em]", children: [_jsx("span", { children: finding.severity }), _jsx("span", { className: "truncate", children: finding.file })] }), _jsx("div", { className: "text-sm font-semibold normal-case tracking-normal", children: finding.summary }), _jsx("div", { className: "text-sm leading-6 opacity-80 normal-case tracking-normal", children: finding.explanation })] }));
}
