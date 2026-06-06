import { AppShell } from "@/components/layout/app-shell";

export function SettingsPage() {
  return (
    <AppShell>
      <div className="grid h-full place-items-center p-10">
        <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-8 shadow-sm">
          <h1 className="m-0 text-2xl font-semibold">Settings</h1>
          <p className="mb-0 mt-3 text-sm text-[rgb(var(--muted))]">这里会配置模型 provider 和隐私策略。</p>
        </div>
      </div>
    </AppShell>
  );
}
