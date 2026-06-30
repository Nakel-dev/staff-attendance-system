import { createClient } from "@/lib/supabase/server";
import {
  getAuthenticatedProfile,
  getOrganizationDisplayName,
  getProfileWithOrganization,
} from "@/lib/supabase/profile";
import { AppShell } from "@/components/layout/AppShell";
import { AUTH_PATH } from "@/constants";
import { redirect } from "next/navigation";

export default async function PortalLayout({
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

  return (
    <AppShell
      profile={profile}
      organizationName={organizationName}
      notifications={notifications || []}
      pendingLeaves={pendingLeaves || 0}
    >
      {children}
    </AppShell>
  );
}
