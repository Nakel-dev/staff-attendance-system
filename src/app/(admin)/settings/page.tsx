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
  if ("error" in settings) {
    return (
      <div className="mx-auto max-w-lg space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="text-lg font-semibold">Could not load settings</h2>
        <p className="text-sm text-muted-foreground">{settings.error}</p>
        <p className="text-sm text-muted-foreground">
          If you just added biometric providers, run{" "}
          <code className="rounded bg-muted px-1">013_biometric_provider.sql</code> in the Supabase
          SQL Editor, then refresh this page.
        </p>
      </div>
    );
  }

  const kiosksResult = await listKioskDevices();
  const kiosks = "kiosks" in kiosksResult ? kiosksResult.kiosks : [];

  return <OrganizationSettings organization={settings.organization} kiosks={kiosks || []} />;
}
