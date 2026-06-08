import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

interface SidebarHeaderProps {
  status: "idle" | "running" | "partial" | "finished" | "failed";
}

const statusConfig = {
  idle: null,
  running: { label: "审查中...", status: "running" as const },
  partial: { label: "部分完成", status: "running" as const },
  finished: { label: "已完成", status: "finished" as const },
  failed: { label: "失败", status: "failed" as const }
};

export function SidebarHeader({ status }: SidebarHeaderProps) {
  const navigate = useNavigate();
  const config = statusConfig[status];

  return (
    <div className="flex items-center justify-between p-3 border-b border-border-default">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={16} />
        <span className="text-sm">返回首页</span>
      </button>
      {config && (
        <StatusBadge status={config.status} label={config.label} />
      )}
    </div>
  );
}
