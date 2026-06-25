import { createClient } from "@/lib/supabase/server";
import { getProfileWithOrganization, getOrganizationDisplayName, getAuthenticatedProfile } from "@/lib/supabase/profile";
import { AUTH_PATH } from "@/constants";
import { redirect } from "next/navigation";
import { StaffCard } from "@/components/staff/StaffCard";
import { StaffForm } from "@/components/staff/StaffForm";
import { StaffProfileView } from "@/components/staff/StaffProfileView";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Header } from "@/components/layout/Header";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_PATH);

  const profile = await getAuthenticatedProfile(user.id);

  if (!profile) redirect(AUTH_PATH);

  const profileWithOrg = await getProfileWithOrganization(user.id);
  const organizationName = getOrganizationDisplayName(profileWithOrg);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-31`;

  const { data: monthAttendance } = await supabase
    .from("attendance")
    .select("*")
    .eq("staff_id", profile.id)
    .gte("date", monthStart)
    .lte("date", monthEnd)
    .order("date", { ascending: false });

  const { data: allAttendance } = await supabase
    .from("attendance")
    .select("*")
    .eq("staff_id", profile.id)
    .order("date", { ascending: false });

  const { data: leaves } = await supabase
    .from("leaves")
    .select("*")
    .eq("staff_id", profile.id)
    .order("created_at", { ascending: false });

  const { count: pendingLeaves } = await supabase
    .from("leaves")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const isAdmin = profile.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        role={profile.role}
        organizationName={organizationName}
        pendingLeaves={pendingLeaves || 0}
        profilePath="/profile"
      />
      <div className="md:pl-64">
        <Header
          title="My Profile"
          profile={profile}
          notifications={notifications || []}
          profilePath="/profile"
        />
        <main className="p-4 md:p-6 pb-20 md:pb-6">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <StaffCard profile={profile} />
              {isAdmin && <StaffForm profile={profile} />}
            </div>
            <StaffProfileView
              staffId={profile.id}
              initialMonth={month}
              initialYear={year}
              monthAttendance={monthAttendance || []}
              allAttendance={allAttendance || []}
              leaves={leaves || []}
            />
          </div>
        </main>
      </div>
      <MobileNav role={profile.role} pendingLeaves={pendingLeaves || 0} />
    </div>
  );
}
