export function ProviderProfileForm() {
  return (
    <section className="grid gap-4 rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] p-5 transition hover:-translate-y-0.5 hover:border-[rgb(var(--border-strong))] hover:shadow-[0_14px_30px_rgba(29,31,35,0.05)]">
      <div className="grid gap-1">
        <h2 className="m-0 text-lg font-semibold text-[rgb(var(--ink))]">模型服务配置</h2>
        <p className="m-0 text-sm leading-6 text-[rgb(var(--muted-strong))]">配置兼容的模型地址与默认模型名称。</p>
      </div>
      <label className="grid gap-2 text-sm">
        <span className="font-medium">模型地址</span>
        <input
          aria-label="模型地址"
          className="h-10 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--panel-muted))] px-3 transition hover:border-[rgb(var(--border-strong))] focus:border-[rgb(var(--accent-border))] focus:outline-none focus:ring-2 focus:ring-[rgba(184,112,75,0.18)]"
          defaultValue="https://api.openai.com/v1"
        />
      </label>
      <label className="grid gap-2 text-sm">
        <span className="font-medium">模型名称</span>
        <input
          aria-label="模型名称"
          className="h-10 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--panel-muted))] px-3 transition hover:border-[rgb(var(--border-strong))] focus:border-[rgb(var(--accent-border))] focus:outline-none focus:ring-2 focus:ring-[rgba(184,112,75,0.18)]"
          defaultValue="gpt-5"
        />
      </label>
    </section>
  );
}
