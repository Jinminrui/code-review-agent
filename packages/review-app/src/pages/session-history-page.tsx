import { sessionStatusLabel } from "@/lib/review-copy";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { ipcClient } from "@/lib/ipc-client";
import type { ReviewSessionDetail } from "@/lib/review-model";

export function SessionHistoryPage() {
  const [sessions, setSessions] = useState<ReviewSessionDetail[]>([]);

  useEffect(() => {
    void ipcClient.listSessions().then(setSessions);
  }, []);

  return (
    <AppShell>
      <div className="h-full bg-[rgb(var(--panel-muted))] p-6">
        <div className="mx-auto grid h-full max-w-5xl content-start gap-6">
          <section className="grid gap-2 rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-[rgb(var(--muted))]">Review Archive</div>
            <h1 className="m-0 text-[34px] font-semibold tracking-[-0.04em] text-[rgb(var(--ink))]">Code Review 历史</h1>
            <p className="m-0 text-[14px] leading-6 text-[rgb(var(--muted-strong))]">
              回看已经完成或中途保留的 Code Review 记录，继续从问题流进入对应的 diff 验证现场。
            </p>
          </section>

          <section className="grid gap-4">
            {sessions.length === 0 ? (
              <div className="rounded-[26px] border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] p-6 text-sm leading-6 text-[rgb(var(--muted-strong))]">
                还没有可回看的 Code Review 记录。发起一次新的 Code Review 后，这里会保留你的历史会话。
              </div>
            ) : (
              sessions.map((session) => (
                <Link
                  key={session.sessionId}
                  to={`/sessions/${session.sessionId}`}
                  className="grid gap-4 rounded-[26px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] p-5 text-[rgb(var(--ink))] no-underline transition hover:-translate-y-0.5 hover:border-[rgb(var(--border-strong))] hover:shadow-[0_16px_40px_rgba(29,31,35,0.06)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid gap-1">
                      <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-[rgb(var(--muted))]">
                        Review Record
                      </div>
                      <div className="text-[18px] font-semibold tracking-[-0.02em] text-[rgb(var(--ink))]">
                        {session.baseRef} -&gt; {session.targetRef}
                      </div>
                      <div className="text-sm text-[rgb(var(--muted-strong))]">{session.repositoryPath}</div>
                    </div>
                    <span className="rounded-full bg-[rgb(var(--accent-soft))] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--accent-ink))]">
                      {sessionStatusLabel[session.status]}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-[20px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--panel-muted))] p-3 text-sm text-[rgb(var(--ink))]">
                      变更文件 {session.summary.changedFilesCount}
                    </div>
                    <div className="rounded-[20px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--panel-muted))] p-3 text-sm text-[rgb(var(--ink))]">
                      问题总数 {session.summary.findingsCount}
                    </div>
                    <div className="rounded-[20px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--panel-muted))] p-3 text-sm text-[rgb(var(--ink))]">
                      高风险 {session.summary.highSeverityCount}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
