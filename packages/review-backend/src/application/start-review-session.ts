/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import type { ReviewSessionEvent, ReviewSessionInput } from "../domain/review-session.js";
import { streamReviewSession } from "./stream-review-session.js";

export async function startReviewSession(input: {
  input: ReviewSessionInput;
  signal?: AbortSignal;
  dependencies: Parameters<typeof streamReviewSession>[0]["dependencies"];
}) {
  const events: ReviewSessionEvent[] = [];

  for await (const event of streamReviewSession(input)) {
    events.push(event);
  }

  const sessionId = events[0]?.sessionId ?? `session:${input.input.baseRef}:${input.input.targetRef}`;

  return {
    sessionId,
    events
  };
}
