/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { useNavigate } from "react-router-dom";
import { ArrowLeft, XCircle } from "lucide-react";
import { StatusBadge, type Status } from "@/components/ui/status-badge";

interface SidebarHeaderProps {
  status: Status;
  onCancel?: () => void;
  isCancelling?: boolean;
}

const statusConfig: Record<string, { label: string; status: Status } | null> = {
  idle: null,
  running: { label: "审查中...", status: "running" },
  streaming: { label: "审查中...", status: "streaming" },
  partial: { label: "部分完成", status: "partial" },
  finished: { label: "已完成", status: "finished" },
  failed: { label: "失败", status: "failed" },
  pending: { label: "等待中", status: "pending" }
};

export function SidebarHeader({ status, onCancel, isCancelling }: SidebarHeaderProps) {
  const navigate = useNavigate();
  const config = statusConfig[status];
  const isRunning = status === "running" || status === "streaming" || status === "pending";

  return (
    <div className="flex items-center justify-between p-3 border-b border-border-default">
      {isRunning ? (
        <button
          onClick={onCancel}
          disabled={isCancelling}
          className="flex items-center gap-2 text-accent-red hover:text-accent-red/80 disabled:text-text-disabled transition-colors"
        >
          <XCircle size={16} />
          <span className="text-sm">{isCancelling ? "正在中止..." : "中止审查"}</span>
        </button>
      ) : (
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">返回首页</span>
        </button>
      )}
      {config && (
        <StatusBadge status={config.status} label={config.label} />
      )}
    </div>
  );
}
