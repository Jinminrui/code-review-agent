export function PrivacySettingsForm() {
  return (
    <section className="grid gap-4 rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] p-5 transition hover:-translate-y-0.5 hover:border-[rgb(var(--border-strong))] hover:shadow-[0_14px_30px_rgba(29,31,35,0.05)]">
      <div className="grid gap-1">
        <h2 className="m-0 text-lg font-semibold text-[rgb(var(--ink))]">会发送到模型的内容</h2>
        <p className="m-0 text-sm leading-6 text-[rgb(var(--muted-strong))]">只发送完成结构化审查所必需的上下文，不直接开放本地文件系统。</p>
      </div>
      <ul className="m-0 grid gap-2 pl-5 text-sm leading-6 text-[rgb(var(--muted))]">
        <li>分支差异</li>
        <li>必要代码片段</li>
        <li>补充上下文文件内容</li>
      </ul>
    </section>
  );
}
