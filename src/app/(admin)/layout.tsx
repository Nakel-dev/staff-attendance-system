import { createClient } from "@/lib/supabase/server";
import { getProfileWithOrganization, getOrganizationDisplayName, getAuthenticatedProfile } from "@/lib/supabase/profile";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Header } from "@/components/layout/Header";
import { redirect } from "next/navigation";
import { AUTH_PATH } from "@/constants";

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

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        role="admin"
        organizationName={organizationName}
        pendingLeaves={pendingLeaves || 0}
        profilePath="/profile"
      />
      <div className="md:pl-64">
        <Header
          title="Admin Portal"
          profile={profile}
          notifications={notifications || []}
          profilePath="/profile"
        />
        <main className="p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      </div>
      <MobileNav role="admin" pendingLeaves={pendingLeaves || 0} />
    </div>
  );
}
