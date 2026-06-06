type BranchSelectorProps = {
  label: string;
  value: string;
  branches: string[];
  onChange(value: string): void;
};

export function BranchSelector({ label, value, branches, onChange }: BranchSelectorProps) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-[13px] font-medium tracking-[-0.01em] text-[rgb(var(--ink))]">{label}</span>
      <select
        aria-label={label}
        className="h-11 rounded-[14px] border border-[rgb(var(--border))] bg-[rgb(var(--panel))] px-3 text-[13px] font-normal text-[rgb(var(--ink))] transition hover:border-[rgb(var(--border-strong))] focus:border-[rgb(var(--accent-border))] focus:outline-none focus:ring-2 focus:ring-[rgba(67,104,170,0.18)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">请选择分支</option>
        {branches.map((branch) => (
          <option key={branch} value={branch}>
            {branch}
          </option>
        ))}
      </select>
    </label>
  );
}
