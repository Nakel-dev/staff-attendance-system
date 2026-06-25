"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LeaveForm } from "@/components/leaves/LeaveForm";
import { LeaveTable } from "@/components/leaves/LeaveTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LEAVE_BALANCE } from "@/constants";
import { calculateLeaveBalance } from "@/lib/utils/calculateStats";
import type { Leave } from "@/lib/types";

interface MyLeavesViewProps {
  staffId: string;
  initialLeaves: Leave[];
}

export function MyLeavesView({ staffId, initialLeaves }: MyLeavesViewProps) {
  const router = useRouter();
  const [leaves, setLeaves] = useState(initialLeaves);

  const handleLeaveSubmitted = (leave: Leave) => {
    setLeaves((prev) => [leave, ...prev]);
    router.refresh();
  };

  const handleLeaveUpdated = (leaveId: string, updates: Partial<Leave>) => {
    setLeaves((prev) =>
      prev.map((leave) => (leave.id === leaveId ? { ...leave, ...updates } : leave))
    );
    router.refresh();
  };

  const handleLeaveRemoved = (leaveId: string) => {
    setLeaves((prev) => prev.filter((leave) => leave.id !== leaveId));
    router.refresh();
  };

  const approvedLeaves = useMemo(
    () => leaves.filter((leave) => leave.status === "approved"),
    [leaves]
  );
  const pendingLeaves = useMemo(
    () => leaves.filter((leave) => leave.status === "pending"),
    [leaves]
  );
  const rejectedLeaves = useMemo(
    () => leaves.filter((leave) => leave.status === "rejected"),
    [leaves]
  );

  const annualBalance = calculateLeaveBalance(approvedLeaves, "annual", LEAVE_BALANCE.annual);
  const sickBalance = calculateLeaveBalance(approvedLeaves, "sick", LEAVE_BALANCE.sick);
  const pendingCount = pendingLeaves.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">My Leaves</h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Apply for leave, track balances, and monitor request status
          </p>
        </div>
        <LeaveForm staffId={staffId} onLeaveSubmitted={handleLeaveSubmitted} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Annual Leave</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Allowance</span>
              <span>{annualBalance.allowance} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Used</span>
              <span>{annualBalance.used} days</span>
            </div>
            <div className="flex justify-between font-semibold text-primary">
              <span>Remaining</span>
              <span>{annualBalance.remaining} days</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sick Leave</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Allowance</span>
              <span>{sickBalance.allowance} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Used</span>
              <span>{sickBalance.used} days</span>
            </div>
            <div className="flex justify-between font-semibold text-primary">
              <span>Remaining</span>
              <span>{sickBalance.remaining} days</span>
            </div>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2 xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick Status</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-yellow-500/10 p-3">
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              <p className="text-muted-foreground">Pending</p>
            </div>
            <div className="rounded-lg bg-green-500/10 p-3">
              <p className="text-2xl font-bold text-green-600">{approvedLeaves.length}</p>
              <p className="text-muted-foreground">Approved</p>
            </div>
            <div className="rounded-lg bg-red-500/10 p-3">
              <p className="text-2xl font-bold text-red-600">{rejectedLeaves.length}</p>
              <p className="text-muted-foreground">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending">
            <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto p-1">
              <TabsTrigger value="pending" className="shrink-0">
                Pending ({pendingCount})
              </TabsTrigger>
              <TabsTrigger value="approved" className="shrink-0">
                Approved ({approvedLeaves.length})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="shrink-0">
                Rejected ({rejectedLeaves.length})
              </TabsTrigger>
              <TabsTrigger value="all" className="shrink-0">
                All ({leaves.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="pending" className="mt-4">
              <LeaveTable
                leaves={pendingLeaves}
                showStaff={false}
                allowCancel
                onLeaveUpdated={handleLeaveUpdated}
                onLeaveRemoved={handleLeaveRemoved}
              />
            </TabsContent>
            <TabsContent value="approved" className="mt-4">
              <LeaveTable leaves={approvedLeaves} showStaff={false} />
            </TabsContent>
            <TabsContent value="rejected" className="mt-4">
              <LeaveTable leaves={rejectedLeaves} showStaff={false} />
            </TabsContent>
            <TabsContent value="all" className="mt-4">
              <LeaveTable
                leaves={leaves}
                showStaff={false}
                allowCancel
                onLeaveUpdated={handleLeaveUpdated}
                onLeaveRemoved={handleLeaveRemoved}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
