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
      <div className="mx-auto grid h-full max-w-4xl content-start gap-4 px-10 py-12">
        <h1 className="m-0 text-3xl font-semibold text-[rgb(var(--ink))]">历史会话</h1>
        {sessions.map((session) => (
          <Link
            key={session.sessionId}
            to={`/sessions/${session.sessionId}`}
            className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-4 text-[rgb(var(--ink))] no-underline"
          >
            {session.baseRef} -&gt; {session.targetRef} / {session.status}
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
