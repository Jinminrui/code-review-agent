import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { ipcClient } from "@/lib/ipc-client";
export function SessionHistoryPage() {
    const [sessions, setSessions] = useState([]);
    useEffect(() => {
        void ipcClient.listSessions().then(setSessions);
    }, []);
    return (_jsx(AppShell, { children: _jsxs("div", { className: "mx-auto grid h-full max-w-4xl content-start gap-4 px-10 py-12", children: [_jsx("h1", { className: "m-0 text-3xl font-semibold text-[rgb(var(--ink))]", children: "\u5386\u53F2\u4F1A\u8BDD" }), sessions.map((session) => (_jsxs(Link, { to: `/sessions/${session.sessionId}`, className: "rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-4 text-[rgb(var(--ink))] no-underline", children: [session.baseRef, " -> ", session.targetRef, " / ", session.status] }, session.sessionId)))] }) }));
}
