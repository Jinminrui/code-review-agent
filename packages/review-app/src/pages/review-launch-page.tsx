import { AppShell } from "@/components/layout/app-shell";

export function ReviewLaunchPage() {
  return (
    <AppShell>
      <div className="grid h-full place-items-center p-10">
        <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-8 shadow-sm">
          <h1 className="m-0 text-2xl font-semibold">Review Workbench</h1>
          <p className="mb-0 mt-3 max-w-xl text-sm text-[rgb(var(--muted))]">
            项目骨架已初始化。下一步会在这里接入仓库选择、分支对比和发起审查表单。
          </p>
        </div>
      </div>
    </AppShell>
  );
}
