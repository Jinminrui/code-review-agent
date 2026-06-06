type RepositoryPickerProps = {
  repositories: string[];
  value: string;
  onChange(value: string): void;
};

export function RepositoryPicker({ repositories, value, onChange }: RepositoryPickerProps) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-[13px] font-medium tracking-[-0.01em] text-[rgb(var(--ink))]">仓库</span>
      <select
        aria-label="仓库"
        className="h-11 rounded-[14px] border border-[rgb(var(--border))] bg-[rgb(var(--panel))] px-3 text-[13px] font-normal text-[rgb(var(--ink))] transition hover:border-[rgb(var(--border-strong))] focus:border-[rgb(var(--accent-border))] focus:outline-none focus:ring-2 focus:ring-[rgba(67,104,170,0.18)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">请选择仓库</option>
        {repositories.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}
