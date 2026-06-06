import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="grid h-full grid-cols-[260px_1fr] bg-[rgb(var(--bg))]">
      <aside className="border-r border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[rgb(var(--muted))]">
          Review Workbench
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
