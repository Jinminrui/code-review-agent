import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function RepositoryPicker({ repositories, value, onChange }) {
    return (_jsxs("label", { className: "grid gap-2 text-sm", children: [_jsx("span", { className: "font-medium text-[rgb(var(--ink))]", children: "\u4ED3\u5E93" }), _jsxs("select", { "aria-label": "\u4ED3\u5E93", className: "h-11 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--panel))] px-3 text-[rgb(var(--ink))]", value: value, onChange: (event) => onChange(event.target.value), children: [_jsx("option", { value: "", children: "\u8BF7\u9009\u62E9\u4ED3\u5E93" }), repositories.map((item) => (_jsx("option", { value: item, children: item }, item)))] })] }));
}
