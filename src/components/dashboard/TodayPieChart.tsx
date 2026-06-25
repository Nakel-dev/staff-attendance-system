"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { DashboardStats } from "@/lib/types";
import { getTodayPieData } from "@/lib/utils/calculateStats";

interface TodayPieChartProps {
  stats: DashboardStats;
}

export function TodayPieChart({ stats }: TodayPieChartProps) {
  const pieData = getTodayPieData(stats);

  if (pieData.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">No attendance data for today</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
          {pieData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
