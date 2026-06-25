"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { LeaveType } from "@/lib/types";

async function notifyAdmins(title: string, message: string, organizationId: string) {
  const adminClient = createAdminClient();
  const { data: admins } = await adminClient
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true)
    .eq("organization_id", organizationId);

  if (admins?.length) {
    const notifications = admins.map((admin) => ({
      user_id: admin.id,
      title,
      message,
      type: "leave_request" as const,
    }));
    await adminClient.from("notifications").insert(notifications);
  }
}

export async function applyForLeave(data: {
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) return { error: "Profile not found" };

    if (new Date(data.end_date) < new Date(data.start_date)) {
      return { error: "End date must be after start date" };
    }

    const { error } = await supabase.from("leaves").insert({
      staff_id: profile.id,
      leave_type: data.leave_type,
      start_date: data.start_date,
      end_date: data.end_date,
      reason: data.reason,
      status: "pending",
    });

    if (error) return { error: error.message };

    const { data: insertedLeave, error: fetchError } = await supabase
      .from("leaves")
      .select("*")
      .eq("staff_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !insertedLeave) return { error: "Leave submitted but could not load record" };

    await notifyAdmins(
      "New Leave Request",
      `${profile.full_name} submitted a ${data.leave_type} leave request from ${data.start_date} to ${data.end_date}.`,
      profile.organization_id
    );

    revalidatePath("/my-leaves");
    revalidatePath("/leaves");
    revalidatePath("/dashboard");
    return { success: true, leave: insertedLeave };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to apply for leave" };
  }
}

export async function reviewLeave(
  leaveId: string,
  status: "approved" | "rejected",
  adminNote?: string
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (adminProfile?.role !== "admin") return { error: "Unauthorized" };

    const { data: leave } = await supabase
      .from("leaves")
      .select("*, profiles(full_name)")
      .eq("id", leaveId)
      .single();

    if (!leave) return { error: "Leave not found" };

    const { error } = await supabase
      .from("leaves")
      .update({
        status,
        admin_note: adminNote || null,
        reviewed_by: adminProfile.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", leaveId);

    if (error) return { error: error.message };

    await supabase.from("notifications").insert({
      user_id: leave.staff_id,
      title: status === "approved" ? "Leave Approved" : "Leave Rejected",
      message:
        status === "approved"
          ? `Your leave request from ${leave.start_date} to ${leave.end_date} has been approved.${adminNote ? ` Note: ${adminNote}` : ""}`
          : `Your leave request from ${leave.start_date} to ${leave.end_date} has been rejected.${adminNote ? ` Reason: ${adminNote}` : ""}`,
      type: status === "approved" ? "leave_approved" : "leave_rejected",
    });

    revalidatePath("/leaves");
    revalidatePath("/my-leaves");
    revalidatePath("/dashboard");
    return { success: true, leaveId, status };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to review leave" };
  }
}

export async function cancelLeave(leaveId: string) {
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

    const { data: leave } = await supabase
      .from("leaves")
      .select("id, staff_id, status")
      .eq("id", leaveId)
      .single();

    if (!leave) return { error: "Leave not found" };
    if (leave.staff_id !== profile.id) return { error: "Unauthorized" };
    if (leave.status !== "pending") return { error: "Only pending requests can be cancelled" };

    const { error } = await supabase.from("leaves").delete().eq("id", leaveId);
    if (error) return { error: error.message };

    revalidatePath("/my-leaves");
    revalidatePath("/leaves");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to cancel leave" };
  }
}

export async function getPendingLeaveCount() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("leaves")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  return count || 0;
}
