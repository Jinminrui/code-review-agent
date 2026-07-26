/**
 * 模块职责：连接 Electron 主进程、IPC 和 renderer，负责桌面生命周期与权限边界。
 * 边界约束：IPC 入参先校验，再调用 backend application；不要把主进程能力直接暴露给页面。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
export function getPreloadFilename() {
  return "preload.cjs";
}
