/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
export const severityLabel = {
  high: "高风险",
  medium: "中风险",
  low: "低风险"
} as const;

export const findingStatusLabel = {
  "line-level": "行级定位",
  "file-level": "文件级定位"
} as const;

export const sessionStatusLabel = {
  idle: "等待中",
  running: "审查中",
  partial: "部分完成",
  finished: "已完成",
  failed: "失败",
  cancelled: "已中止"
} as const;
