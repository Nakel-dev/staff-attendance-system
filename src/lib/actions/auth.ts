"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "organization";
}

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function uniqueSlug(base: string) {
  const admin = createAdminClient();
  let slug = base;
  let attempt = 0;
  while (attempt < 10) {
    const { data } = await admin.from("organizations").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
  return `${base}-${Date.now()}`;
}

async function uniqueInviteCode() {
  const admin = createAdminClient();
  for (let i = 0; i < 10; i++) {
    const code = generateInviteCode();
    const { data } = await admin.from("organizations").select("id").eq("invite_code", code).maybeSingle();
    if (!data) return code;
  }
  return generateInviteCode() + "X";
}

export async function registerOrganization(data: {
  organizationName: string;
  fullName: string;
  email: string;
  password: string;
  department?: string;
}) {
  try {
    const orgName = data.organizationName.trim();
    const fullName = data.fullName.trim();
    const email = data.email.trim().toLowerCase();

    if (!orgName || orgName.length < 2) return { error: "Organization name must be at least 2 characters" };
    if (!fullName) return { error: "Full name is required" };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address" };
    if (data.password.length < 8) return { error: "Password must be at least 8 characters" };

    const admin = createAdminClient();
    const slug = await uniqueSlug(slugify(orgName));
    const inviteCode = await uniqueInviteCode();

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });

    if (authError) return { error: authError.message };

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({ name: orgName, slug, invite_code: inviteCode })
      .select("id, invite_code")
      .single();

    if (orgError || !org) {
      await admin.auth.admin.deleteUser(authUser.user.id);
      return { error: orgError?.message || "Failed to create organization" };
    }

    const { error: profileError } = await admin.from("profiles").insert({
      user_id: authUser.user.id,
      organization_id: org.id,
      full_name: fullName,
      email,
      department: data.department?.trim() || "Administration",
      role: "admin",
      is_active: true,
      date_joined: new Date().toISOString().slice(0, 10),
    });

    if (profileError) {
      await admin.from("organizations").delete().eq("id", org.id);
      await admin.auth.admin.deleteUser(authUser.user.id);
      return { error: profileError.message };
    }

    revalidatePath("/auth");
    return { success: true, inviteCode: org.invite_code };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Registration failed" };
  }
}

export async function registerStaffMember(data: {
  inviteCode: string;
  fullName: string;
  email: string;
  password: string;
  department: string;
}) {
  try {
    const inviteCode = data.inviteCode.trim().toUpperCase();
    const fullName = data.fullName.trim();
    const email = data.email.trim().toLowerCase();

    if (!inviteCode) return { error: "Organization invite code is required" };
    if (!fullName) return { error: "Full name is required" };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address" };
    if (data.password.length < 8) return { error: "Password must be at least 8 characters" };
    if (!data.department) return { error: "Department is required" };

    const admin = createAdminClient();

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("id, name")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (orgError || !org) return { error: "Invalid invite code. Check with your organization admin." };

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });

    if (authError) return { error: authError.message };

    const { error: profileError } = await admin.from("profiles").insert({
      user_id: authUser.user.id,
      organization_id: org.id,
      full_name: fullName,
      email,
      department: data.department,
      role: "staff",
      is_active: true,
      date_joined: new Date().toISOString().slice(0, 10),
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(authUser.user.id);
      return { error: profileError.message };
    }

    revalidatePath("/auth");
    return { success: true, organizationName: org.name };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Registration failed" };
  }
}

export async function signInUser(email: string, password: string) {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) return { error: error.message };
    if (!data.user) return { error: "Sign in failed. Please try again." };

    // Use service role: same-request profile reads via anon client can fail before JWT applies
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role, is_active")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      return {
        error: "No profile found for this account. Register an organization first or contact support.",
      };
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      return { error: "Your account has been deactivated." };
    }

    return { success: true, role: profile.role as "admin" | "staff" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sign in failed" };
  }
}

export async function getOrganizationInviteCode() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, organization_id")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin" || !profile.organization_id) {
      return { error: "Unauthorized" };
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("invite_code, name")
      .eq("id", profile.organization_id)
      .single();

    if (!org) return { error: "Organization not found" };
    return { inviteCode: org.invite_code, organizationName: org.name };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to fetch invite code" };
  }
}

function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function requestPasswordReset(email: string) {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${getAppUrl()}/auth/reset-password`,
    });
    if (error) return { error: error.message };
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send reset email" };
  }
}

export async function updatePassword(password: string) {
  try {
    if (password.length < 8) return { error: "Password must be at least 8 characters" };
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update password" };
  }
}
