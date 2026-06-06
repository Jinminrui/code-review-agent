type BranchSelectorProps = {
  label: string;
  value: string;
  branches: string[];
  onChange(value: string): void;
};

export function BranchSelector({ label, value, branches, onChange }: BranchSelectorProps) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-[rgb(var(--ink))]">{label}</span>
      <select
        aria-label={label}
        className="h-11 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--panel))] px-3 text-[rgb(var(--ink))]"
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
