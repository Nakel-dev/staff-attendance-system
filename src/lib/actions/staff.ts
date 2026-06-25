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

async function requireOrgAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("user_id", user.id)
    .single();

  if (adminProfile?.role !== "admin" || !adminProfile.organization_id) {
    return { error: "Unauthorized" as const };
  }

  return { adminProfile, supabase };
}

async function assertStaffInOrg(staffId: string, organizationId: string) {
  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, user_id, organization_id, email")
    .eq("id", staffId)
    .single();

  if (!target || target.organization_id !== organizationId) {
    return { error: "Staff member not found in your organization" as const };
  }

  return { target, admin };
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
    const auth = await requireOrgAdmin();
    if ("error" in auth) return { error: auth.error };

    const password = generatePassword();
    const adminClient = createAdminClient();

    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: data.email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });

    if (authError) return { error: authError.message };

    const { error: profileError } = await adminClient.from("profiles").insert({
      user_id: authUser.user.id,
      organization_id: auth.adminProfile.organization_id,
      full_name: data.full_name.trim(),
      email: data.email.trim().toLowerCase(),
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
    const auth = await requireOrgAdmin();
    if ("error" in auth) return { error: auth.error };

    const scope = await assertStaffInOrg(id, auth.adminProfile.organization_id);
    if ("error" in scope) return { error: scope.error };

    const { error } = await scope.admin
      .from("profiles")
      .update({
        full_name: data.full_name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone || null,
        department: data.department,
        role: data.role,
        date_joined: data.date_joined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return { error: error.message };

    const nextEmail = data.email.trim().toLowerCase();
    if (nextEmail !== scope.target.email) {
      await scope.admin.auth.admin.updateUserById(scope.target.user_id, {
        email: nextEmail,
      });
    }

    revalidatePath("/staff");
    revalidatePath(`/staff/${id}`);
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update staff" };
  }
}

export async function toggleStaffStatus(id: string, isActive: boolean) {
  try {
    const auth = await requireOrgAdmin();
    if ("error" in auth) return { error: auth.error };

    if (id === auth.adminProfile.id) {
      return { error: "You cannot deactivate your own account" };
    }

    const scope = await assertStaffInOrg(id, auth.adminProfile.organization_id);
    if ("error" in scope) return { error: scope.error };

    const { error } = await scope.admin
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
    const auth = await requireOrgAdmin();
    if ("error" in auth) return { error: auth.error };

    if (id === auth.adminProfile.id) {
      return { error: "You cannot delete your own account" };
    }

    const scope = await assertStaffInOrg(id, auth.adminProfile.organization_id);
    if ("error" in scope) return { error: scope.error };

    const { error: profileError } = await scope.admin.from("profiles").delete().eq("id", id);
    if (profileError) return { error: profileError.message };

    await scope.admin.auth.admin.deleteUser(scope.target.user_id);

    revalidatePath("/staff");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete staff" };
  }
}

export async function updateOwnProfile(data: {
  full_name: string;
  phone?: string;
  department: string;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: data.full_name.trim(),
        phone: data.phone || null,
        department: data.department,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (error) return { error: error.message };

    revalidatePath("/profile");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update profile" };
  }
}
