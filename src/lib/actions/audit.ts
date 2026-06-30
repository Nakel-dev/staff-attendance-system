"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logInfo } from "@/lib/logging/logger";

export async function writeAuditLog(input: {
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) return;

    const headerStore = await headers();
    const requestId = headerStore.get("x-request-id") || undefined;
    const ipAddress =
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headerStore.get("x-real-ip") ||
      undefined;

    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      organization_id: profile.organization_id,
      actor_user_id: user.id,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId || null,
      metadata: input.metadata || {},
      ip_address: ipAddress || null,
      request_id: requestId || null,
    });

    logInfo("audit_log", {
      action: input.action,
      resourceType: input.resourceType,
      requestId,
    });
  } catch {
    // Audit logging must not break primary flows.
  }
}
