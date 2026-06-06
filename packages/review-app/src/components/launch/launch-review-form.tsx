import { startTransition, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ipcClient } from "@/lib/ipc-client";
import { BranchSelector } from "./branch-selector";
import { RepositoryPicker } from "./repository-picker";

export function LaunchReviewForm() {
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
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
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid h-full max-w-6xl items-center gap-6 lg:grid-cols-[1.08fr_0.92fr]">
      <section className="grid gap-6 rounded-[30px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] p-8 shadow-[0_24px_80px_rgba(31,35,41,0.05)]">
        <div className="grid gap-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.34em] text-[rgb(var(--muted))]">
            Code Review Intake
          </div>
          <h1 className="m-0 text-[42px] font-semibold tracking-[-0.045em] text-[rgb(var(--ink))]">发起一次 Code Review</h1>
          <p className="m-0 max-w-2xl text-[15px] leading-7 text-[rgb(var(--muted-strong))]">
            选择本地仓库与目标分支，在进入 Code Review 工作台前完成一次清晰、可追踪的启动流程。
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              title: "改动摘要",
              body: "先看到这次改动主要落在哪些文件和链路。"
            },
            {
              title: "Review Findings",
              body: "优先识别高风险 finding 与证据线索。"
            },
            {
              title: "Diff 验证",
              body: "从问题条目直接跳到对应上下文继续核查。"
            }
          ].map((item) => (
            <article
              key={item.title}
              className="grid gap-2 rounded-[22px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--panel-muted))] p-4 transition hover:-translate-y-0.5 hover:border-[rgb(var(--border-strong))] hover:shadow-[0_14px_28px_rgba(29,31,35,0.05)]"
            >
              <div className="text-sm font-medium tracking-[-0.01em] text-[rgb(var(--ink))]">{item.title}</div>
              <p className="m-0 text-[13px] leading-6 text-[rgb(var(--muted-strong))]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 rounded-[30px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] p-6 shadow-[0_24px_80px_rgba(31,35,41,0.06)]">
        <div className="grid gap-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-[rgb(var(--muted))]">
            Review Setup
          </div>
          <div className="text-[22px] font-semibold tracking-[-0.03em] text-[rgb(var(--ink))]">选择仓库与分支</div>
          <p className="m-0 text-[14px] leading-6 text-[rgb(var(--muted-strong))]">
            Code Review 会话会保存当前输入，后续可以在 Review 历史里回看与重进工作台。
          </p>
        </div>

        <RepositoryPicker repositories={repositories} value={repositoryPath} onChange={setRepositoryPath} />
        <div className="grid gap-5 md:grid-cols-2">
          <BranchSelector label="基线分支" value={baseRef} branches={branches} onChange={setBaseRef} />
          <BranchSelector label="目标分支" value={targetRef} branches={branches} onChange={setTargetRef} />
        </div>
        <button
          type="button"
          className="h-11 justify-self-start whitespace-nowrap rounded-[14px] bg-[rgb(var(--accent))] px-5 text-[13px] font-medium tracking-[0.01em] text-white shadow-[0_10px_30px_rgba(67,104,170,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(67,104,170,0.24)] focus:outline-none focus:ring-2 focus:ring-[rgba(67,104,170,0.25)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_10px_30px_rgba(67,104,170,0.18)]"
          disabled={!repositoryPath || !baseRef || !targetRef || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? "正在创建 Code Review..." : "开始 Code Review"}
        </button>
      </section>
    </div>
  );
}
