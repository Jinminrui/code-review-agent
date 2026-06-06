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
    <div className="mx-auto grid h-full max-w-4xl content-center gap-6 px-10 py-12">
      <div className="grid gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[rgb(var(--muted))]">
          Launch Review
        </div>
        <h1 className="m-0 text-4xl font-semibold tracking-[-0.03em] text-[rgb(var(--ink))]">发起一次新审查</h1>
        <p className="m-0 max-w-2xl text-sm leading-6 text-[rgb(var(--muted))]">
          选择本地仓库与目标分支，工作台会展示改动摘要、风险卡片和可定位的 diff 详情。
        </p>
      </div>

      <div className="grid gap-5 rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-6 shadow-[0_24px_80px_rgba(31,35,41,0.06)]">
        <RepositoryPicker repositories={repositories} value={repositoryPath} onChange={setRepositoryPath} />
        <div className="grid gap-5 md:grid-cols-2">
          <BranchSelector label="Base 分支" value={baseRef} branches={branches} onChange={setBaseRef} />
          <BranchSelector label="Target 分支" value={targetRef} branches={branches} onChange={setTargetRef} />
        </div>
        <button
          type="button"
          className="h-11 justify-self-start rounded-full bg-[rgb(var(--accent))] px-6 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!repositoryPath || !baseRef || !targetRef || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? "正在创建..." : "开始审查"}
        </button>
      </div>
    </div>
  );
}
