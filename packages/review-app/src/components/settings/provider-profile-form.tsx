export function ProviderProfileForm() {
  return (
    <section className="grid gap-4 rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-5">
      <h2 className="m-0 text-lg font-semibold text-[rgb(var(--ink))]">Provider 配置</h2>
      <label className="grid gap-2 text-sm">
        <span className="font-medium">模型地址</span>
        <input
          aria-label="模型地址"
          className="h-10 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3"
          defaultValue="https://api.openai.com/v1"
        />
      </label>
      <label className="grid gap-2 text-sm">
        <span className="font-medium">模型名称</span>
        <input
          aria-label="模型名称"
          className="h-10 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3"
          defaultValue="gpt-5"
        />
      </label>
    </section>
  );
}
