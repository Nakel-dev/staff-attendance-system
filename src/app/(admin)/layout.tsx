import { createClient } from "@/lib/supabase/server";
import { getProfileWithOrganization, getOrganizationDisplayName, getAuthenticatedProfile } from "@/lib/supabase/profile";
import { AppShell } from "@/components/layout/AppShell";
import { redirect } from "next/navigation";
import { AUTH_PATH } from "@/constants";
import { getSignedProfilePhotoUrl } from "@/lib/storage/photos";

const ADMIN_PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/staff": "Staff Management",
  "/attendance": "Mark Attendance",
  "/leaves": "Leave Requests",
  "/reports": "Reports",
  "/settings": "Settings",
  "/review-queue": "Review Queue",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(AUTH_PATH);

  const profile = await getAuthenticatedProfile(user.id);

  if (!profile) redirect(`${AUTH_PATH}?error=profile-not-found`);

  if (profile.role !== "admin") redirect("/my-attendance");

  const profileWithOrg = await getProfileWithOrganization(user.id);
  const organizationName = getOrganizationDisplayName(profileWithOrg);

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

  const avatarDisplayUrl = await getSignedProfilePhotoUrl(profile.avatar_url);
  const profileForShell = { ...profile, avatar_url: avatarDisplayUrl || profile.avatar_url };

  return (
    <AppShell
      profile={profileForShell}
      organizationName={organizationName}
      notifications={notifications || []}
      pendingLeaves={pendingLeaves || 0}
      pageTitles={ADMIN_PAGE_TITLES}
      defaultTitle="Admin Portal"
    >
      {children}
    </AppShell>
  );
}
