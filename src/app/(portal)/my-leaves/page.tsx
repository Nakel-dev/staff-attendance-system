import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedProfile } from "@/lib/supabase/profile";
import { MyLeavesView } from "@/components/leaves/MyLeavesView";
import { AUTH_PATH } from "@/constants";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MyLeavesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_PATH);

  const profile = await getAuthenticatedProfile(user.id);
  if (!profile) redirect(`${AUTH_PATH}?error=profile-not-found`);

  const { data: leaves } = await supabase
    .from("leaves")
    .select("*")
    .eq("staff_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <MyLeavesView staffId={profile.id} initialLeaves={leaves || []} />
    </div>
  );
}
