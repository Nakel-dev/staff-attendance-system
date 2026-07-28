"use client";

import { Camera, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Attendance } from "@/lib/types";
import { StaffAttendanceStatus } from "@/components/attendance/StaffAttendanceStatus";

/**
 * Self check-in from the staff portal is disabled.
 * Clock in/out must happen at the reception kiosk with facial verification.
 */
export function StaffCheckInPanel({ todayRecord }: { todayRecord: Attendance | null }) {
  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-5 w-5" />
            Reception kiosk required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            You cannot clock in or out from the staff portal. Use the office reception kiosk for
            facial verification each day.
          </p>
          <a
            href="/profile?enroll=1"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Camera className="h-4 w-4" />
            Set up photo & face
          </a>
        </CardContent>
      </Card>
      <StaffAttendanceStatus todayRecord={todayRecord} />
    </div>
  );
}
