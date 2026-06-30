"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  clearVerificationFlag,
  getCheckInPhotoSignedUrl,
  getFlaggedCheckIns,
} from "@/lib/actions/attendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Attendance } from "@/lib/types";
import { useRouter } from "next/navigation";

export function FlaggedCheckInsPanel() {
  const router = useRouter();
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [clearingId, setClearingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const result = await getFlaggedCheckIns(8);
      setLoading(false);
      if ("error" in result) return;
      setRecords(result.records);

      const urls: Record<string, string> = {};
      for (const record of result.records) {
        if (record.check_in_photo_url) {
          const photo = await getCheckInPhotoSignedUrl(record.check_in_photo_url);
          if ("url" in photo && photo.url) urls[record.id] = photo.url;
        }
      }
      setPhotoUrls(urls);
    })();
  }, []);

  const handleClear = async (id: string) => {
    setClearingId(id);
    const result = await clearVerificationFlag(id);
    setClearingId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setRecords((prev) => prev.filter((r) => r.id !== id));
    toast.success("Flag cleared");
    router.refresh();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0) return null;

  return (
    <Card className="border-amber-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5" />
          Flagged Check-Ins
        </CardTitle>
        <CardDescription>Review suspicious or out-of-policy check-ins from your team</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {records.map((record) => (
          <div
            key={record.id}
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="space-y-1">
              <p className="font-medium">{record.profiles?.full_name || "Staff member"}</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(record.date), "MMM d, yyyy")}
                {record.check_in_time ? ` · ${record.check_in_time.slice(0, 5)}` : ""}
              </p>
              {record.verification_note && (
                <p className="text-sm text-amber-700 dark:text-amber-400">{record.verification_note}</p>
              )}
              {photoUrls[record.id] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrls[record.id]}
                  alt="Check-in selfie"
                  className="mt-2 h-24 w-24 rounded-md border object-cover"
                />
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleClear(record.id)}
              disabled={clearingId === record.id}
            >
              {clearingId === record.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Clear flag
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
