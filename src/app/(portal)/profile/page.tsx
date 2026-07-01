import { createClient } from "@/lib/supabase/server";
import { AUTH_PATH } from "@/constants";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { StaffCard } from "@/components/staff/StaffCard";
import { StaffForm } from "@/components/staff/StaffForm";
import { StaffProfileView } from "@/components/staff/StaffProfileView";
import { ProfilePhotoCard } from "@/components/profile/ProfilePhotoCard";
import { MfaSettingsCard } from "@/components/profile/MfaSettingsCard";
import { getAuthenticatedProfile } from "@/lib/supabase/profile";
import { getSignedProfilePhotoUrl } from "@/lib/storage/photos";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_PATH);

  const profile = await getAuthenticatedProfile(user.id);
  if (!profile) redirect(`${AUTH_PATH}?error=profile-not-found`);

  const avatarDisplayUrl = await getSignedProfilePhotoUrl(profile.avatar_url);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
  const monthEnd = format(new Date(year, month, 0), "yyyy-MM-dd");

  const [
    { data: monthAttendance },
    { data: allAttendance },
    { data: leaves },
  ] = await Promise.all([
    supabase
      .from("attendance")
      .select("*")
      .eq("staff_id", profile.id)
      .gte("date", monthStart)
      .lte("date", monthEnd)
      .order("date", { ascending: false }),
    supabase
      .from("attendance")
      .select("*")
      .eq("staff_id", profile.id)
      .order("date", { ascending: false }),
    supabase
      .from("leaves")
      .select("*")
      .eq("staff_id", profile.id)
      .order("created_at", { ascending: false }),
  ]);

  const isAdmin = profile.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My Profile</h2>
        <p className="text-muted-foreground">
          Upload your profile photo for the reception kiosk and manage your account
        </p>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <StaffCard profile={profile} avatarDisplayUrl={avatarDisplayUrl} />
        {isAdmin && <StaffForm profile={profile} />}
      </div>
      <ProfilePhotoCard profile={profile} avatarDisplayUrl={avatarDisplayUrl} />
      <MfaSettingsCard />
      <StaffProfileView
        staffId={profile.id}
        initialMonth={month}
        initialYear={year}
        monthAttendance={monthAttendance || []}
        allAttendance={allAttendance || []}
        leaves={leaves || []}
      />
    </div>
  );
}
