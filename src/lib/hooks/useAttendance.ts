"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import type { Attendance } from "@/lib/types";

export function useAttendance(staffId?: string, month?: number, year?: number) {
  const [data, setData] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      let query = supabase.from("attendance").select("*, profiles(*)").order("date", { ascending: false });

      if (staffId) query = query.eq("staff_id", staffId);
      if (month && year) {
        const start = `${year}-${String(month).padStart(2, "0")}-01`;
        const end = `${year}-${String(month).padStart(2, "0")}-31`;
        query = query.gte("date", start).lte("date", end);
      }

      const { data: records, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setData(records || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch attendance");
    } finally {
      setLoading(false);
    }
  }, [staffId, month, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
