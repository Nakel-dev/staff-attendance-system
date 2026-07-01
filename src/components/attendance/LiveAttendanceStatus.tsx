"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LiveAttendanceStatusProps {
  staffId: string;
}

interface AttendanceRecordRow {
  id: string;
  type: "check_in" | "check_out";
  server_timestamp: string;
  match_status: string;
}

export function LiveAttendanceStatus({ staffId }: LiveAttendanceStatusProps) {
  const [records, setRecords] = useState<AttendanceRecordRow[]>([]);
  const [liveMessage, setLiveMessage] = useState("Waiting for kiosk updates…");

  useEffect(() => {
    const supabase = createClient();

    void supabase
      .from("attendance_records")
      .select("id, type, server_timestamp, match_status")
      .eq("staff_id", staffId)
      .order("server_timestamp", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data?.length) {
          setRecords(data as AttendanceRecordRow[]);
          const latest = data[0] as AttendanceRecordRow;
          setLiveMessage(
            latest.type === "check_in"
              ? `Checked in at ${format(new Date(latest.server_timestamp), "h:mm a")}`
              : `Checked out at ${format(new Date(latest.server_timestamp), "h:mm a")}`
          );
        }
      });

    const channel = supabase
      .channel(`attendance-records-${staffId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendance_records",
          filter: `staff_id=eq.${staffId}`,
        },
        (payload) => {
          const row = payload.new as AttendanceRecordRow;
          setRecords((prev) => [row, ...prev].slice(0, 5));
          setLiveMessage(
            row.type === "check_in"
              ? `Checked in at ${format(new Date(row.server_timestamp), "h:mm a")}`
              : `Checked out at ${format(new Date(row.server_timestamp), "h:mm a")}`
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [staffId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Live kiosk status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-lg font-semibold text-primary">{liveMessage}</p>
        {records.length > 0 && (
          <ul className="text-muted-foreground space-y-1 text-sm">
            {records.map((row) => (
              <li key={row.id}>
                {row.type === "check_in" ? "In" : "Out"} ·{" "}
                {format(new Date(row.server_timestamp), "MMM d, h:mm a")} · {row.match_status}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
