import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { MyAttendanceView } from "@/components/attendance/MyAttendanceView";
import { redirect } from "next/navigation";
import { AUTH_PATH } from "@/constants";

export default async function MyAttendancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_PATH);

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect(AUTH_PATH);

  const now = new Date();
  const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
  const monthEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");
  const today = format(now, "yyyy-MM-dd");

  const { data: records } = await supabase
    .from("attendance")
    .select("*")
    .eq("staff_id", profile.id)
    .gte("date", monthStart)
    .lte("date", monthEnd)
    .order("date", { ascending: false });

  const { data: allRecords } = await supabase
    .from("attendance")
    .select("*")
    .eq("staff_id", profile.id)
    .order("date", { ascending: false });

  const { data: todayRecord } = await supabase
    .from("attendance")
    .select("*")
    .eq("staff_id", profile.id)
    .eq("date", today)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My Attendance</h2>
        <p className="text-muted-foreground">View your attendance records and check in</p>
      </div>
      <MyAttendanceView
        staffId={profile.id}
        initialRecords={allRecords || records || []}
        todayRecord={todayRecord}
      />
    </div>
  );
}
