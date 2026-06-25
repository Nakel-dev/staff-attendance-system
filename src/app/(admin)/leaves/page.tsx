import { createClient } from "@/lib/supabase/server";
import { LeaveTable } from "@/components/leaves/LeaveTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function LeavesPage() {
  const supabase = await createClient();
  const { data: leaves } = await supabase
    .from("leaves")
    .select("*, profiles(*)")
    .order("created_at", { ascending: false });

  const pending = (leaves || []).filter((l) => l.status === "pending");
  const approved = (leaves || []).filter((l) => l.status === "approved");
  const rejected = (leaves || []).filter((l) => l.status === "rejected");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Leave Requests</h2>
        <p className="text-muted-foreground">Review and manage staff leave applications</p>
      </div>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
          <TabsTrigger value="all">All ({(leaves || []).length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <LeaveTable leaves={pending} isAdmin showStaff />
        </TabsContent>
        <TabsContent value="approved">
          <LeaveTable leaves={approved} isAdmin showStaff />
        </TabsContent>
        <TabsContent value="rejected">
          <LeaveTable leaves={rejected} isAdmin showStaff />
        </TabsContent>
        <TabsContent value="all">
          <LeaveTable leaves={leaves || []} isAdmin showStaff />
        </TabsContent>
      </Tabs>
    </div>
  );
}
