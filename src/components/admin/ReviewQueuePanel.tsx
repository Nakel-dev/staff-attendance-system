"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReviewItem {
  id: string;
  staff_id: string;
  attempt_type: string;
  reason: string;
  live_capture_url: string | null;
  liveCaptureSignedUrl?: string;
  storedReferenceSignedUrl?: string;
  created_at: string;
  profiles?: { full_name?: string; employee_code?: string; department?: string };
}

const REASON_LABELS: Record<string, string> = {
  missing_photo: "Missing photo",
  duplicate_day: "Duplicate same day",
  photo_review: "No profile photo on file",
  low_confidence: "Low confidence",
  no_match: "No match",
  liveness_fail: "Liveness failed",
};

export function ReviewQueuePanel() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/review-queue");
    const data = await res.json();
    if (res.ok) setItems(data.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (id: string, decision: "approved" | "rejected") => {
    setResolving(id);
    const res = await fetch(`/api/admin/review-queue/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const data = await res.json();
    setResolving(null);
    if (!res.ok) {
      toast.error(data.error || "Could not resolve review");
      return;
    }
    toast.success(decision === "approved" ? "Approved and clocked" : "Rejected");
    void load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">No pending review items.</p>;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <CardTitle className="text-base">
              {item.profiles?.full_name || "Unknown staff"} · {item.attempt_type.replace("_", " ")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Reason:{" "}
              <span className="font-medium">
                {REASON_LABELS[item.reason] || item.reason.replace("_", " ")}
              </span>
            </p>
            <p className="text-muted-foreground text-sm">
              {item.profiles?.employee_code || "—"} · {item.profiles?.department || "—"}
            </p>
            {(item.liveCaptureSignedUrl || item.storedReferenceSignedUrl) && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Kiosk capture</p>
                  {item.liveCaptureSignedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.liveCaptureSignedUrl}
                      alt="Kiosk capture"
                      className="aspect-[4/3] w-full rounded-md border object-cover"
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">No photo captured</p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Profile photo on file</p>
                  {item.storedReferenceSignedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.storedReferenceSignedUrl}
                      alt="Profile reference"
                      className="aspect-[4/3] w-full rounded-md border object-cover"
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">No profile photo uploaded</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => void resolve(item.id, "approved")}
                disabled={resolving === item.id}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void resolve(item.id, "rejected")}
                disabled={resolving === item.id}
              >
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
