import { AppShell } from "@/components/layout/app-shell";
import { DiffEmptyState } from "@/components/session/diff-empty-state";
import { SessionProgress } from "@/components/session/session-progress";

export function ReviewSessionPage() {
  return (
    <AppShell>
      <div className="grid h-full grid-cols-[360px_1fr]">
        <aside className="border-r border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-4">
          <SessionProgress status="idle" />
        </aside>
        <section className="min-w-0">
          <DiffEmptyState />
        </section>
      </div>
    </AppShell>
  );
}
