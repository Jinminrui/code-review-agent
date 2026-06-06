import { AppShell } from "@/components/layout/app-shell";
import { LaunchReviewForm } from "@/components/launch/launch-review-form";

export function ReviewLaunchPage() {
  return (
    <AppShell>
      <div className="h-full bg-[rgb(var(--panel-muted))] p-6">
        <LaunchReviewForm />
      </div>
    </AppShell>
  );
}
