"use client";

import { format } from "date-fns";
import { Camera, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Attendance } from "@/lib/types";

interface StaffAttendanceStatusProps {
  todayRecord: Attendance | null;
}

export function StaffAttendanceStatus({ todayRecord }: StaffAttendanceStatusProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Monitor className="h-5 w-5" />
          Today&apos;s attendance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Clock in and out at the reception kiosk using your name, PIN, and a quick photo. Your
          portal is for viewing records and uploading your profile photo.
        </p>
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Check in</span>
            <span className="font-medium">
              {todayRecord?.check_in_time ? format(new Date(`1970-01-01T${todayRecord.check_in_time}`), "h:mm a") : "—"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Check out</span>
            <span className="font-medium">
              {todayRecord?.check_out_time ? format(new Date(`1970-01-01T${todayRecord.check_out_time}`), "h:mm a") : "—"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium capitalize">{todayRecord?.status || "Not marked"}</span>
          </div>
        </div>
        <a
          href="/profile"
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Camera className="h-4 w-4" />
          Upload profile photo
        </a>
      </CardContent>
    </Card>
  );
}
