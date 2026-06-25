import { createClient } from "@/lib/supabase/server";
import { LeaveForm } from "@/components/leaves/LeaveForm";
import { LeaveTable } from "@/components/leaves/LeaveTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LEAVE_BALANCE } from "@/constants";
import { calculateLeaveBalance } from "@/lib/utils/calculateStats";
import { redirect } from "next/navigation";

export default async function MyLeavesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { data: leaves } = await supabase
    .from("leaves")
    .select("*")
    .eq("staff_id", profile.id)
    .order("created_at", { ascending: false });

  const approvedLeaves = (leaves || []).filter((l) => l.status === "approved");
  const annualBalance = calculateLeaveBalance(approvedLeaves, "annual", LEAVE_BALANCE.annual);
  const sickBalance = calculateLeaveBalance(approvedLeaves, "sick", LEAVE_BALANCE.sick);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">My Leaves</h2>
          <p className="text-muted-foreground">Apply for leave and track your requests</p>
        </div>
        <LeaveForm />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Annual Leave</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between text-sm">
              <span>Allowance: {annualBalance.allowance} days</span>
              <span>Used: {annualBalance.used} days</span>
              <span className="font-semibold text-primary">Remaining: {annualBalance.remaining} days</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sick Leave</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between text-sm">
              <span>Allowance: {sickBalance.allowance} days</span>
              <span>Used: {sickBalance.used} days</span>
              <span className="font-semibold text-primary">Remaining: {sickBalance.remaining} days</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leave History</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaveTable leaves={leaves || []} showStaff={false} />
        </CardContent>
      </Card>
    </div>
  );
}
