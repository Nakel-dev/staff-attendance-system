import { format, parseISO, formatDistanceToNow } from "date-fns";

export function formatDate(date: string | Date, pattern = "MMM d, yyyy") {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern);
}

export function formatTime(time: string) {
  if (!time) return "—";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function timeAgo(date: string) {
  return formatDistanceToNow(parseISO(date), { addSuffix: true });
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getMonthYear(date: Date) {
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

export function getMonthDateRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
    daysInMonth: end.getDate(),
  };
}

export function getWorkingDaysInMonth(year: number, month: number) {
  const { daysInMonth } = getMonthDateRange(year, month);
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}
