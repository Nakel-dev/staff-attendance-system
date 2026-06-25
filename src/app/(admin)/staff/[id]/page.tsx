import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { StaffCard } from "@/components/staff/StaffCard";
import { StaffForm } from "@/components/staff/StaffForm";
import { StaffProfileView } from "@/components/staff/StaffProfileView";

export default async function StaffProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!profile) notFound();

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-31`;

  const { data: monthAttendance } = await supabase
    .from("attendance")
    .select("*")
    .eq("staff_id", params.id)
    .gte("date", monthStart)
    .lte("date", monthEnd)
    .order("date", { ascending: false });

  const { data: allAttendance } = await supabase
    .from("attendance")
    .select("*")
    .eq("staff_id", params.id)
    .order("date", { ascending: false });

  const { data: leaves } = await supabase
    .from("leaves")
    .select("*")
    .eq("staff_id", params.id)
    .order("created_at", { ascending: false });

  const { data: currentUser } = await supabase.auth.getUser();
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", currentUser.user?.id || "")
    .single();

  const isAdmin = currentProfile?.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <StaffCard profile={profile} />
        {isAdmin && <StaffForm profile={profile} />}
      </div>
      <StaffProfileView
        staffId={params.id}
        initialMonth={month}
        initialYear={year}
        monthAttendance={monthAttendance || []}
        allAttendance={allAttendance || []}
        leaves={leaves || []}
      />
    </div>
  );
}
