import { AppShell } from "@/components/layout/app-shell";
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

  return (
    <AppShell>
      <div className="grid h-full grid-cols-[360px_1fr]">
        <aside className="grid gap-4 overflow-auto border-r border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-4">
          <SessionProgress status={session?.status ?? "idle"} />
          {session ? (
            <>
              <ReviewSummaryPanel
                changedFilesCount={session.summary.changedFilesCount}
                findingsCount={session.summary.findingsCount}
                highSeverityCount={session.summary.highSeverityCount}
              />
              <RiskFileList files={session.summary.files} />
              <FindingList
                findings={session.findings}
                selectedFindingId={selectedFindingId}
                onSelect={setSelectedFinding}
              />
            </>
          ) : null}
        </aside>
        <section className="min-w-0">
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
    </AppShell>
  );
}
