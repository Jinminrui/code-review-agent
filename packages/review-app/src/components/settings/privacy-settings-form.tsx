export function PrivacySettingsForm() {
  return (
    <section className="grid gap-4 rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-5">
      <h2 className="m-0 text-lg font-semibold text-[rgb(var(--ink))]">会发送到模型的内容</h2>
      <ul className="m-0 grid gap-2 pl-5 text-sm leading-6 text-[rgb(var(--muted))]">
        <li>分支 diff</li>
        <li>必要代码片段</li>
        <li>补充上下文文件内容</li>
      </ul>
    </section>
  );
}
