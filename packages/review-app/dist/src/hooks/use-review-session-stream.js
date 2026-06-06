import { useEffect } from "react";
import { ipcClient } from "@/lib/ipc-client";
import { useReviewSessionStore } from "@/store/review-session-store";
export function useReviewSessionStream(sessionId) {
    const setSession = useReviewSessionStore((state) => state.setSession);
    useEffect(() => {
        if (!sessionId) {
            setSession(null);
            return;
        }
        let active = true;
        void ipcClient.getSession(sessionId).then((session) => {
            if (active) {
                setSession(session);
            }
        });
        const unsubscribe = ipcClient.subscribeSession(sessionId, async () => {
            const nextSession = await ipcClient.getSession(sessionId);
            if (active) {
                setSession(nextSession);
            }
        });
        return () => {
            active = false;
            unsubscribe();
        };
    }, [sessionId, setSession]);
}
