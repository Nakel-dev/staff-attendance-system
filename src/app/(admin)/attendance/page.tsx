import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { AttendanceMarker } from "@/components/attendance/AttendanceMarker";
import { CheckInKiosk } from "@/components/attendance/CheckInKiosk";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const supabase = await createClient();
  const selectedDate = searchParams.date || format(new Date(), "yyyy-MM-dd");

  const { data: staff } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_active", true)
    .eq("role", "staff")
    .order("full_name");

  const { data: existingRecords } = await supabase
    .from("attendance")
    .select("*, profiles(*)")
    .eq("date", selectedDate);

  const { data: currentUser } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", currentUser.user?.id || "")
    .single();

  const today = format(new Date(), "yyyy-MM-dd");
  const { data: todayRecord } = profile
    ? await supabase
        .from("attendance")
        .select("*")
        .eq("staff_id", profile.id)
        .eq("date", today)
        .maybeSingle()
    : { data: null };

  if (profile?.role === "staff") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Attendance</h2>
          <p className="text-muted-foreground">Check in and view your attendance</p>
        </div>
        <AttendanceMarker mode="staff" todayRecord={todayRecord} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Mark Attendance</h2>
        <p className="text-muted-foreground">Record attendance for all active staff members</p>
      </div>
      <CheckInKiosk />
      <AttendanceMarker
        mode="admin"
        staff={staff || []}
        existingRecords={existingRecords || []}
      />
    </div>
  );
}
