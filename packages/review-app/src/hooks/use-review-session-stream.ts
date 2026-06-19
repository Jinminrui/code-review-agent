import { useEffect } from "react";
import { ipcClient } from "@/lib/ipc-client";
import { useReviewSessionStore } from "@/store/review-session-store";
import type { ReviewSessionEvent } from "@/lib/review-model";

export function useReviewSessionStream(sessionId: string) {
  const setSession = useReviewSessionStore((state) => state.setSession);
  const addFindings = useReviewSessionStore((state) => state.addFindings);
  const updateSessionStatus = useReviewSessionStore((state) => state.updateSessionStatus);
  const setError = useReviewSessionStore((state) => state.setError);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setError(null);
      return;
    }

    let active = true;

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

      switch (event.type) {
        case "unit-completed":
          addFindings(event.findings);
          break;

        case "unit-failed":
          updateSessionStatus("partial");
          break;

        case "session-finished":
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
      active = false;
      unsubscribe();
    };
  }, [sessionId, setSession, addFindings, updateSessionStatus, setError]);
}
