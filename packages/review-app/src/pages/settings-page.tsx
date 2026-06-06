import { AppShell } from "@/components/layout/app-shell";
import { PrivacySettingsForm } from "@/components/settings/privacy-settings-form";
import { ProviderProfileForm } from "@/components/settings/provider-profile-form";

export function SettingsPage() {
  return (
    <AppShell>
      <div className="h-full bg-[rgb(var(--panel-muted))] p-6">
        <div className="mx-auto grid h-full max-w-5xl content-start gap-6">
          <section className="grid gap-2 rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] p-6">
            <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-[rgb(var(--muted))]">设置</div>
            <h1 className="m-0 text-[34px] font-semibold tracking-[-0.04em] text-[rgb(var(--ink))]">模型与 Privacy</h1>
            <p className="m-0 text-[14px] leading-6 text-[rgb(var(--muted-strong))]">
              管理模型服务连接方式，并确认哪些内容会发送到模型侧参与 Code Review。
            </p>
          </section>
          <ProviderProfileForm />
          <PrivacySettingsForm />
        </div>
      </div>
    </AppShell>
  );
}
