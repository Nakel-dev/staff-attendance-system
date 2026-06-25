"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ATTENDANCE_STATUS_COLORS, ATTENDANCE_STATUS_LABELS } from "@/constants";
import { cn } from "@/lib/utils";
import type { Attendance } from "@/lib/types";

interface AttendanceCalendarProps {
  records: Attendance[];
  month: number;
  year: number;
  onMonthChange: (month: number, year: number) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AttendanceCalendar({
  records,
  month,
  year,
  onMonthChange,
}: AttendanceCalendarProps) {
  const currentDate = new Date(year, month - 1, 1);
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const recordsByDate = records.reduce<Record<string, Attendance>>((acc, record) => {
    acc[record.date] = record;
    return acc;
  }, {});

  const handlePrevMonth = () => {
    const prev = addMonths(currentDate, -1);
    onMonthChange(prev.getMonth() + 1, prev.getFullYear());
  };

  const handleNextMonth = () => {
    const next = addMonths(currentDate, 1);
    onMonthChange(next.getMonth() + 1, next.getFullYear());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={handlePrevMonth}>
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous month</span>
        </Button>
        <h3 className="text-lg font-semibold">{format(currentDate, "MMMM yyyy")}</h3>
        <Button variant="outline" size="icon" onClick={handleNextMonth}>
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Next month</span>
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const record = recordsByDate[dateKey];
          const status = record?.status || "none";
          const inCurrentMonth = isSameMonth(day, currentDate);
          const isToday = dateKey === format(new Date(), "yyyy-MM-dd");

          return (
            <div
              key={dateKey}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-md border p-2 min-h-[72px] transition-colors",
                inCurrentMonth ? "bg-card" : "bg-muted/30 text-muted-foreground",
                isToday && "ring-2 ring-primary ring-offset-1"
              )}
              title={
                record
                  ? `${format(day, "MMM d")}: ${ATTENDANCE_STATUS_LABELS[record.status]}`
                  : format(day, "MMM d")
              }
            >
              <span className={cn("text-sm font-medium", !inCurrentMonth && "opacity-50")}>
                {format(day, "d")}
              </span>
              <span
                className={cn(
                  "mt-1 h-2.5 w-2.5 rounded-full",
                  ATTENDANCE_STATUS_COLORS[status]
                )}
              />
              {record && inCurrentMonth && (
                <span className="mt-1 text-[10px] text-muted-foreground truncate max-w-full px-1">
                  {ATTENDANCE_STATUS_LABELS[record.status]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        {(["present", "absent", "late", "half-day", "none"] as const).map((status) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", ATTENDANCE_STATUS_COLORS[status])} />
            <span>{status === "none" ? "No record" : ATTENDANCE_STATUS_LABELS[status]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
