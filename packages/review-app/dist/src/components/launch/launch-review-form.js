import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { startTransition, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ipcClient } from "@/lib/ipc-client";
import { BranchSelector } from "./branch-selector";
import { RepositoryPicker } from "./repository-picker";
export function LaunchReviewForm() {
    const navigate = useNavigate();
    const [repositories, setRepositories] = useState([]);
    const [branches, setBranches] = useState([]);
    const [repositoryPath, setRepositoryPath] = useState("");
    const [baseRef, setBaseRef] = useState("");
    const [targetRef, setTargetRef] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    useEffect(() => {
        void ipcClient.listRepositories().then(setRepositories);
    }, []);
    useEffect(() => {
        if (!repositoryPath) {
            setBranches([]);
            setBaseRef("");
            setTargetRef("");
            return;
        }
        void ipcClient.listBranches(repositoryPath).then((nextBranches) => {
            setBranches(nextBranches);
            setBaseRef((current) => (nextBranches.includes(current) ? current : ""));
            setTargetRef((current) => (nextBranches.includes(current) ? current : ""));
        });
    }, [repositoryPath]);
    async function handleSubmit() {
        if (!repositoryPath || !baseRef || !targetRef || isSubmitting) {
            return;
        }
        setIsSubmitting(true);
        try {
            const session = await ipcClient.createSession({
                repositoryPath,
                baseRef,
                targetRef,
                providerProfileId: "default"
            });
            startTransition(() => {
                navigate(`/sessions/${session.sessionId}`);
            });
        }
        finally {
            setIsSubmitting(false);
        }
    }
    return (_jsxs("div", { className: "mx-auto grid h-full max-w-4xl content-center gap-6 px-10 py-12", children: [_jsxs("div", { className: "grid gap-3", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-[0.28em] text-[rgb(var(--muted))]", children: "Launch Review" }), _jsx("h1", { className: "m-0 text-4xl font-semibold tracking-[-0.03em] text-[rgb(var(--ink))]", children: "\u53D1\u8D77\u4E00\u6B21\u65B0\u5BA1\u67E5" }), _jsx("p", { className: "m-0 max-w-2xl text-sm leading-6 text-[rgb(var(--muted))]", children: "\u9009\u62E9\u672C\u5730\u4ED3\u5E93\u4E0E\u76EE\u6807\u5206\u652F\uFF0C\u5DE5\u4F5C\u53F0\u4F1A\u5C55\u793A\u6539\u52A8\u6458\u8981\u3001\u98CE\u9669\u5361\u7247\u548C\u53EF\u5B9A\u4F4D\u7684 diff \u8BE6\u60C5\u3002" })] }), _jsxs("div", { className: "grid gap-5 rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-6 shadow-[0_24px_80px_rgba(31,35,41,0.06)]", children: [_jsx(RepositoryPicker, { repositories: repositories, value: repositoryPath, onChange: setRepositoryPath }), _jsxs("div", { className: "grid gap-5 md:grid-cols-2", children: [_jsx(BranchSelector, { label: "Base \u5206\u652F", value: baseRef, branches: branches, onChange: setBaseRef }), _jsx(BranchSelector, { label: "Target \u5206\u652F", value: targetRef, branches: branches, onChange: setTargetRef })] }), _jsx("button", { type: "button", className: "h-11 justify-self-start rounded-full bg-[rgb(var(--accent))] px-6 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50", disabled: !repositoryPath || !baseRef || !targetRef || isSubmitting, onClick: handleSubmit, children: isSubmitting ? "正在创建..." : "开始审查" })] })] }));
}
