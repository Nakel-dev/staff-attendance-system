"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import type { Leave } from "@/lib/types";

export function useLeaves(staffId?: string, status?: string) {
  const [data, setData] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      let query = supabase
        .from("leaves")
        .select("*, profiles(*)")
        .order("created_at", { ascending: false });

      if (staffId) query = query.eq("staff_id", staffId);
      if (status && status !== "all") query = query.eq("status", status);

      const { data: leaves, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setData(leaves || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch leaves");
    } finally {
      setLoading(false);
    }
  }, [staffId, status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
