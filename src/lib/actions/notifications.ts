"use server";

import { AUTH_PATH } from "@/constants";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function markNotificationRead(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to mark notification" };
  }
}

export async function markAllNotificationsRead() {
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

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", profile.id)
      .eq("is_read", false);

    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to mark notifications" };
  }
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(AUTH_PATH);
}
