type RepositoryPickerProps = {
  repositories: string[];
  value: string;
  onChange(value: string): void;
};

export function RepositoryPicker({ repositories, value, onChange }: RepositoryPickerProps) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-[rgb(var(--ink))]">仓库</span>
      <select
        aria-label="仓库"
        className="h-11 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--panel))] px-3 text-[rgb(var(--ink))]"
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
