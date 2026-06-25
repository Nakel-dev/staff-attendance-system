import { createClient } from "@/lib/supabase/server";
import { getOrganizationInviteCode } from "@/lib/actions/auth";
import { format } from "date-fns";
import Link from "next/link";
import { Users, UserCheck, UserX, Clock, CalendarOff, FileText } from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { AttendanceChart } from "@/components/dashboard/AttendanceChart";
import { TodayPieChart } from "@/components/dashboard/TodayPieChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { InviteCodeCard } from "@/components/dashboard/InviteCodeCard";
import { GettingStartedCard } from "@/components/dashboard/GettingStartedCard";
import { Suspense } from "react";
import { WelcomeBanner } from "@/components/auth/WelcomeBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  calculateDashboardStats,
  getLast7DaysChartData,
} from "@/lib/utils/calculateStats";

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const inviteInfo = await getOrganizationInviteCode();

  const { data: activeStaff } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_active", true)
    .eq("role", "staff");

  const { data: todayAttendance } = await supabase
    .from("attendance")
    .select("*, profiles(*)")
    .eq("date", today);

  const { data: onLeaveToday } = await supabase
    .from("leaves")
    .select("id")
    .eq("status", "approved")
    .lte("start_date", today)
    .gte("end_date", today);

  const { count: pendingLeaves } = await supabase
    .from("leaves")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const sevenDaysAgo = format(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
  const { data: weekAttendance } = await supabase
    .from("attendance")
    .select("*")
    .gte("date", sevenDaysAgo)
    .lte("date", today);

  const { data: recentActivity } = await supabase
    .from("attendance")
    .select("*, profiles(*)")
    .order("created_at", { ascending: false })
    .limit(10);

  const totalStaff = activeStaff?.length || 0;
  const stats = calculateDashboardStats(
    totalStaff,
    todayAttendance || [],
    onLeaveToday?.length || 0,
    pendingLeaves || 0
  );

  const chartData = getLast7DaysChartData(weekAttendance || []);
  const presentPercent =
    totalStaff > 0 ? Math.round((stats.presentToday / totalStaff) * 100) : 0;

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <WelcomeBanner />
      </Suspense>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Overview for {format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <Button asChild>
          <Link href="/attendance">Mark Today&apos;s Attendance</Link>
        </Button>
      </div>

      {"inviteCode" in inviteInfo && inviteInfo.inviteCode && inviteInfo.organizationName && (
        <InviteCodeCard
          inviteCode={inviteInfo.inviteCode}
          organizationName={inviteInfo.organizationName}
        />
      )}

      {totalStaff === 0 && (
        <GettingStartedCard
          inviteCode={
            "inviteCode" in inviteInfo ? inviteInfo.inviteCode : undefined
          }
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatsCard title="Total Active Staff" value={stats.totalStaff} icon={Users} />
        <StatsCard
          title="Present Today"
          value={stats.presentToday}
          subtitle={`${presentPercent}% of staff`}
          icon={UserCheck}
        />
        <StatsCard title="Absent Today" value={stats.absentToday} icon={UserX} />
        <StatsCard title="Late Today" value={stats.lateToday} icon={Clock} />
        <StatsCard title="On Leave Today" value={stats.onLeaveToday} icon={CalendarOff} />
        <StatsCard title="Pending Leaves" value={stats.pendingLeaves} icon={FileText} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Last 7 Days Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <AttendanceChart data={chartData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <TodayPieChart stats={stats} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentActivity records={recentActivity || []} />
        </CardContent>
      </Card>
    </div>
  );
}
