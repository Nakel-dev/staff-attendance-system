"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/types";

function generatePassword(length = 12) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function createStaffMember(data: {
  full_name: string;
  email: string;
  phone?: string;
  department: string;
  role: Role;
  date_joined: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (adminProfile?.role !== "admin") return { error: "Unauthorized" };

    const password = generatePassword();
    const adminClient = createAdminClient();

    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
    });

    if (authError) return { error: authError.message };

    const { error: profileError } = await adminClient.from("profiles").insert({
      user_id: authUser.user.id,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone || null,
      department: data.department,
      role: data.role,
      date_joined: data.date_joined,
      is_active: true,
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(authUser.user.id);
      return { error: profileError.message };
    }

    revalidatePath("/staff");
    return { success: true, password };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create staff" };
  }
}

export async function updateStaffMember(
  id: string,
  data: {
    full_name: string;
    email: string;
    phone?: string;
    department: string;
    role: Role;
    date_joined: string;
  }
) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone || null,
        department: data.department,
        role: data.role,
        date_joined: data.date_joined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/staff");
    revalidatePath(`/staff/${id}`);
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update staff" };
  }
}

export async function toggleStaffStatus(id: string, isActive: boolean) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/staff");
    revalidatePath(`/staff/${id}`);
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update status" };
  }
}

export async function deactivateStaff(id: string) {
  return toggleStaffStatus(id, false);
}

export async function deleteStaffMember(id: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (adminProfile?.role !== "admin") return { error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!profile) return { error: "Staff not found" };

    const adminClient = createAdminClient();
    const { error: profileError } = await adminClient.from("profiles").delete().eq("id", id);
    if (profileError) return { error: profileError.message };

    await adminClient.auth.admin.deleteUser(profile.user_id);

    revalidatePath("/staff");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete staff" };
  }
}
