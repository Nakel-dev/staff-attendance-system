"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AttendanceChartProps {
  data: { date: string; present: number; absent: number; late: number }[];
}

export function AttendanceChart({ data }: AttendanceChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" className="text-xs" />
        <YAxis className="text-xs" />
        <Tooltip />
        <Legend />
        <Bar dataKey="present" fill="#22c55e" name="Present" />
        <Bar dataKey="absent" fill="#ef4444" name="Absent" />
        <Bar dataKey="late" fill="#eab308" name="Late" />
      </BarChart>
    </ResponsiveContainer>
  );
}
