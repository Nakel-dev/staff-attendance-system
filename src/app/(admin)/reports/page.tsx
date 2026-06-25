import { createClient } from "@/lib/supabase/server";
import { ReportsView } from "@/components/reports/ReportsView";

export default async function ReportsPage() {
  const supabase = await createClient();

  const { data: staff } = await supabase.from("profiles").select("*").order("full_name");
  const { data: attendance } = await supabase.from("attendance").select("*");
  const { data: leaves } = await supabase.from("leaves").select("*");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
        <p className="text-muted-foreground">Monthly attendance reports and analytics</p>
      </div>
      <ReportsView staff={staff || []} attendance={attendance || []} leaves={leaves || []} />
    </div>
  );
}
