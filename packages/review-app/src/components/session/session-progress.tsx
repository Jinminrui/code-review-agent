type SessionProgressProps = {
  status: "idle" | "running" | "partial" | "finished" | "failed";
};

export function SessionProgress({ status }: SessionProgressProps) {
  return <div className="rounded-2xl border border-[rgb(var(--border))] p-4 text-sm">当前状态：{status}</div>;
}
