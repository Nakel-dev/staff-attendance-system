import { ReviewQueuePanel } from "@/components/admin/ReviewQueuePanel";

export default function ReviewQueuePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Review queue</h2>
        <p className="text-muted-foreground text-sm">
          Approve or reject kiosk clock attempts that need manual review
        </p>
      </div>
      <ReviewQueuePanel />
    </div>
  );
}
