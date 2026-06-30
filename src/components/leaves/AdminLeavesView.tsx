"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LeaveTable } from "@/components/leaves/LeaveTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Leave } from "@/lib/types";

interface AdminLeavesViewProps {
  initialLeaves: Leave[];
}

export function AdminLeavesView({ initialLeaves }: AdminLeavesViewProps) {
  const router = useRouter();
  const [leaves, setLeaves] = useState(initialLeaves);

  useEffect(() => {
    setLeaves(initialLeaves);
  }, [initialLeaves]);

  const pending = leaves.filter((leave) => leave.status === "pending");
  const approved = leaves.filter((leave) => leave.status === "approved");
  const rejected = leaves.filter((leave) => leave.status === "rejected");

  const handleLeaveUpdated = (leaveId: string, updates: Partial<Leave>) => {
    setLeaves((prev) =>
      prev.map((leave) => (leave.id === leaveId ? { ...leave, ...updates } : leave))
    );
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Leave Requests</h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          Review, approve, or reject staff leave applications
        </p>
      </div>
      <Tabs defaultValue="all">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto p-1">
          <TabsTrigger value="pending" className="shrink-0">
            Pending ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="shrink-0">
            Approved ({approved.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="shrink-0">
            Rejected ({rejected.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="shrink-0">
            All ({leaves.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          <LeaveTable
            leaves={pending}
            isAdmin
            showStaff
            onLeaveUpdated={handleLeaveUpdated}
          />
        </TabsContent>
        <TabsContent value="approved" className="mt-4">
          <LeaveTable leaves={approved} isAdmin showStaff />
        </TabsContent>
        <TabsContent value="rejected" className="mt-4">
          <LeaveTable leaves={rejected} isAdmin showStaff />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <LeaveTable leaves={leaves} isAdmin showStaff onLeaveUpdated={handleLeaveUpdated} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
