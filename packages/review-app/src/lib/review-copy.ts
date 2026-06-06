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
  idle: "Pending",
  running: "In Progress",
  partial: "Partially Complete",
  finished: "Completed",
  failed: "Failed"
} as const;
