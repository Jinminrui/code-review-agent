import { useEffect, useState } from "react";
import { ipcClient } from "@/lib/ipc-client";
import { useReviewSessionStore } from "@/store/review-session-store";
import { createInitialReviewProgress, reduceReviewProgress, type ReviewSessionEvent, type ReviewProgressState } from "@/lib/review-model";

export function useReviewSessionStream(sessionId: string) {
  const [progress, setProgress] = useState<ReviewProgressState>(() => createInitialReviewProgress());
  const setSession = useReviewSessionStore((state) => state.setSession);
  const appendUnitResult = useReviewSessionStore((state) => state.appendUnitResult);
  const updateSessionStatus = useReviewSessionStore((state) => state.updateSessionStatus);
  const setError = useReviewSessionStore((state) => state.setError);

  useEffect(() => {
    setProgress(createInitialReviewProgress());
    if (!sessionId) {
      setSession(null);
      setError(null);
      return;
    }

    let active = true;

    // 先读取快照，再订阅增量事件：快照负责补齐历史数据，事件负责实时更新当前单元。
    void ipcClient.getSession(sessionId).then(
      (session) => {
        if (active) {
          setSession(session);
          setError(null);
        }
      },
      (err) => {
        if (active) {
          console.error("Failed to load session:", err);
          setError(err instanceof Error ? err.message : "加载会话失败");
        }
      }
    );

    const unsubscribe = ipcClient.subscribeSession(sessionId, (event: ReviewSessionEvent) => {
      if (!active) return;
      setProgress((current) => reduceReviewProgress(current, event));

      switch (event.type) {
        case "unit-completed":
          appendUnitResult(event.findings, event.diffByFile);
          break;

        case "unit-failed":
          updateSessionStatus("partial");
          break;

        case "session-finished":
          // 完成事件只携带状态；重新读取快照以获得最终摘要、finding 和 diff。
          updateSessionStatus(event.status);
          void ipcClient.getSession(sessionId).then(
            (nextSession) => {
              if (active) {
                setSession(nextSession);
              }
            },
            (err) => {
              if (active) {
                console.error("Failed to refresh session:", err);
              }
            }
          );
          break;

        case "session-cancelled":
          updateSessionStatus("cancelled");
          void ipcClient.getSession(sessionId).then(
            (nextSession) => {
              if (active) {
                setSession(nextSession);
              }
            },
            (err) => {
              if (active) {
                console.error("Failed to refresh cancelled session:", err);
              }
            }
          );
          break;
      }
    });

    return () => {
      // active 同时阻止已卸载页面的异步回调写入状态。
      active = false;
      unsubscribe();
    };
  }, [sessionId, setSession, appendUnitResult, updateSessionStatus, setError]);

  return { progress };
}
