import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedProfile } from "@/lib/supabase/profile";
import { getOrganizationSettings } from "@/lib/actions/organization";
import { listKioskDevices } from "@/lib/actions/kiosk";
import { OrganizationSettings } from "@/components/settings/OrganizationSettings";
import { AUTH_PATH } from "@/constants";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_PATH);

  const profile = await getAuthenticatedProfile(user.id);
  if (!profile || profile.role !== "admin") redirect("/my-attendance");

  const settings = await getOrganizationSettings();
  if ("error" in settings) redirect("/dashboard");

  const kiosksResult = await listKioskDevices();
  const kiosks = "kiosks" in kiosksResult ? kiosksResult.kiosks : [];

  return <OrganizationSettings organization={settings.organization} kiosks={kiosks || []} />;
}
