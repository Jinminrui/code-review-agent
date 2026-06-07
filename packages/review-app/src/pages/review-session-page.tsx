import { useEffect } from "react";
import { MonacoDiffViewer } from "@/components/diff/monaco-diff-viewer";
import { DiffEmptyState } from "@/components/session/diff-empty-state";
import { FindingList } from "@/components/session/finding-list";
import { ReviewSummaryPanel } from "@/components/session/review-summary-panel";
import { RiskFileList } from "@/components/session/risk-file-list";
import { SessionProgress } from "@/components/session/session-progress";
import { useSelectedFinding } from "@/hooks/use-selected-finding";
import { useReviewSessionStream } from "@/hooks/use-review-session-stream";
import { useReviewSessionStore } from "@/store/review-session-store";
import { useParams } from "react-router-dom";

export function ReviewSessionPage() {
  const { sessionId = "" } = useParams();
  useReviewSessionStream(sessionId);

  const session = useReviewSessionStore((state) => state.session);
  const selectedFindingId = useReviewSessionStore((state) => state.selectedFindingId);
  const setSelectedFinding = useReviewSessionStore((state) => state.setSelectedFinding);
  const selectedFinding = useSelectedFinding();
  const selectedDiff = selectedFinding ? session?.diffByFile[selectedFinding.file] : null;

  useEffect(() => {
    if (!session) {
      return;
    }

    if (session.findings.length === 0) {
      setSelectedFinding(null);
      return;
    }

    if (!selectedFindingId) {
      setSelectedFinding(session.findings[0]?.id ?? null);
    }
  }, [selectedFindingId, session, setSelectedFinding]);

  return (
    <div className="grid h-full grid-cols-[408px_1fr]">
      <aside className="grid min-h-0 grid-rows-[auto_auto_auto_1fr] gap-4 overflow-hidden border-r border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-5">
        <SessionProgress
          status={session?.status ?? "idle"}
        />
        {session ? (
          <>
            <ReviewSummaryPanel
              changedFiles={session.summary.changedFilesCount}
              findings={session.summary.findingsCount}
              highRisk={session.summary.highSeverityCount}
            />
            <RiskFileList files={session.summary.files} />
            <FindingList
              findings={session.findings}
              selectedFindingId={selectedFindingId}
              onSelectFinding={setSelectedFinding}
            />
          </>
        ) : null}
      </aside>
      <section className="min-w-0 bg-[rgb(var(--panel-muted))] p-4">
        {selectedFinding ? (
          <MonacoDiffViewer
            original={selectedDiff?.original ?? ""}
            modified={selectedDiff?.modified ?? ""}
            finding={selectedFinding}
          />
        ) : (
          <DiffEmptyState />
        )}
      </section>
    </div>
  );
}
