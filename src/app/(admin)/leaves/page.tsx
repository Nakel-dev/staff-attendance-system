import { AdminLeavesView } from "@/components/leaves/AdminLeavesView";
import { createClient } from "@/lib/supabase/server";

export default async function LeavesPage() {
  const supabase = await createClient();
  const { data: leaves } = await supabase
    .from("leaves")
    .select("*, profiles(*)")
    .order("created_at", { ascending: false });

  return <AdminLeavesView initialLeaves={leaves || []} />;
}
