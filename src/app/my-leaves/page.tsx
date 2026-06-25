import { createClient } from "@/lib/supabase/server";
import { getProfileWithOrganization, getOrganizationDisplayName, getAuthenticatedProfile } from "@/lib/supabase/profile";
import { AppShell } from "@/components/layout/AppShell";
import { MyLeavesView } from "@/components/leaves/MyLeavesView";
import { AUTH_PATH } from "@/constants";
import { redirect } from "next/navigation";

export default async function MyLeavesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_PATH);

  const profile = await getAuthenticatedProfile(user.id);
  if (!profile) redirect(`${AUTH_PATH}?error=profile-not-found`);

  const profileWithOrg = await getProfileWithOrganization(user.id);
  const organizationName = getOrganizationDisplayName(profileWithOrg);

  const { data: leaves } = await supabase
    .from("leaves")
    .select("*")
    .eq("staff_id", profile.id)
    .order("created_at", { ascending: false });

  const { count: pendingTeamLeaves } = await supabase
    .from("leaves")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <AppShell
      title="My Leaves"
      profile={profile}
      organizationName={organizationName}
      notifications={notifications || []}
      pendingLeaves={pendingTeamLeaves || 0}
    >
      <MyLeavesView staffId={profile.id} initialLeaves={leaves || []} />
    </AppShell>
  );
}
