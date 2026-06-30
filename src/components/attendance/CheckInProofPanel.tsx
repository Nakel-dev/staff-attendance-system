"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, Video } from "lucide-react";
import { getCheckInVideoSignedUrl, getRecentCheckInProofs } from "@/lib/actions/attendance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Attendance } from "@/lib/types";

export function CheckInProofPanel() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const result = await getRecentCheckInProofs(10);
      setLoading(false);
      if ("error" in result) return;
      setRecords(result.records);

      const urls: Record<string, string> = {};
      for (const record of result.records) {
        if (record.check_in_video_url) {
          const video = await getCheckInVideoSignedUrl(record.check_in_video_url);
          if ("url" in video && video.url) urls[record.id] = video.url;
        }
      }
      setVideoUrls(urls);
    })();
  }, []);

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Check-In Verification Proof
        </CardTitle>
        <CardDescription>
          Recent staff check-ins with live video and face verification evidence
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {records.map((record) => (
          <div key={record.id} className="space-y-2 rounded-lg border p-4">
            <div>
              <p className="font-medium">{record.profiles?.full_name || "Staff member"}</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(record.date), "MMM d, yyyy")}
                {record.check_in_time ? ` · In ${record.check_in_time.slice(0, 5)}` : ""}
                {record.check_out_time ? ` · Out ${record.check_out_time.slice(0, 5)}` : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Liveness: {record.liveness_passed ? "passed" : "n/a"} · Face match:{" "}
                {record.face_match_passed ? "passed" : "n/a"}
              </p>
            </div>
            {videoUrls[record.id] ? (
              <video
                src={videoUrls[record.id]}
                controls
                className="w-full max-h-48 rounded-md border bg-black"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Video proof unavailable</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
