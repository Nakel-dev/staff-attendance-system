"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AttendanceStatus } from "@/lib/types";
import type { AttendanceRowInput } from "@/lib/utils/calculateStats";
import { format } from "date-fns";

async function notifyStaff(staffId: string, title: string, message: string) {
  const supabase = await createClient();
  await supabase.from("notifications").insert({
    user_id: staffId,
    title,
    message,
    type: "attendance_marked",
  });
}

export async function saveAttendanceBatch(
  rows: AttendanceRowInput[],
  date: string
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) return { error: "Profile not found" };

    const payload = rows.map((row) => ({
      staff_id: row.staff_id,
      date,
      status: row.status,
      check_in_time: row.check_in_time || null,
      check_out_time: row.check_out_time || null,
      note: row.note || null,
      marked_by: profile.role === "admin" ? profile.id : null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("attendance")
      .upsert(payload, { onConflict: "staff_id,date" });

    if (error) return { error: error.message };

    if (profile.role === "admin") {
      for (const row of rows) {
        await notifyStaff(
          row.staff_id,
          "Attendance Marked",
          `Your attendance for ${date} has been marked as ${row.status}.`
        );
      }
    }

    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    revalidatePath("/my-attendance");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save attendance" };
  }
}

export async function checkInStaff() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) return { error: "Profile not found" };

    const today = format(new Date(), "yyyy-MM-dd");
    const now = format(new Date(), "HH:mm:ss");

    const { data: existing } = await supabase
      .from("attendance")
      .select("*")
      .eq("staff_id", profile.id)
      .eq("date", today)
      .maybeSingle();

    if (existing?.check_in_time) {
      return { error: "Already checked in today" };
    }

    const { error } = await supabase.from("attendance").upsert(
      {
        staff_id: profile.id,
        date: today,
        status: "present" as AttendanceStatus,
        check_in_time: now,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "staff_id,date" }
    );

    if (error) return { error: error.message };

    revalidatePath("/my-attendance");
    revalidatePath("/attendance");
    return { success: true, checkInTime: now };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Check-in failed" };
  }
}
