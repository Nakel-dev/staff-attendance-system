import { createClient } from "@/lib/supabase/server";
import { StaffTable } from "@/components/staff/StaffTable";
import { StaffForm } from "@/components/staff/StaffForm";

export default async function StaffPage() {
  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Staff Management</h2>
          <p className="text-muted-foreground">Manage staff accounts and profiles</p>
        </div>
        <StaffForm />
      </div>
      <StaffTable staff={staff || []} />
    </div>
  );
}
