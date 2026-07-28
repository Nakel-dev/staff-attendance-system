import { createAdminClient } from "@/lib/supabase/admin";

/** Letters from org name → 3–6 char uppercase prefix (e.g. "Greenwood School" → "GREENW"). */
export function orgCodePrefix(organizationName: string): string {
  const letters = organizationName.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (letters.length >= 3) return letters.slice(0, 6);
  const alnum = organizationName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (alnum.length >= 2) return `${alnum}ORG`.slice(0, 6);
  return "STAFF";
}

/**
 * Next unique staff ID for an org: `{PREFIX}-{NNNN}` (e.g. GREENW-0001).
 * Unique per organization via profiles_org_employee_code_uq.
 */
export async function allocateEmployeeCode(
  organizationId: string,
  organizationName?: string
): Promise<string> {
  const admin = createAdminClient();

  let resolvedName = organizationName?.trim() || "";
  if (!resolvedName) {
    const { data: org } = await admin
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle();
    resolvedName = (org?.name && String(org.name).trim()) || "STAFF";
  }

  const prefix = orgCodePrefix(resolvedName);
  const { data } = await admin
    .from("profiles")
    .select("employee_code")
    .eq("organization_id", organizationId)
    .not("employee_code", "is", null);

  const exact = new RegExp(`^${prefix}-(\\d+)$`, "i");
  let max = 0;
  for (const row of data || []) {
    const code = String(row.employee_code || "");
    const m = code.match(exact);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }

  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

/** Assign codes to profiles that still have null employee_code (same org). */
export async function backfillMissingEmployeeCodes(organizationId: string): Promise<number> {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle();

  const { data: missing } = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .is("employee_code", null)
    .order("created_at", { ascending: true });

  let updated = 0;
  for (const row of missing || []) {
    let attempts = 0;
    while (attempts < 3) {
      attempts += 1;
      const code = await allocateEmployeeCode(organizationId, org?.name);
      const { error } = await admin
        .from("profiles")
        .update({ employee_code: code })
        .eq("id", row.id)
        .is("employee_code", null);
      if (!error) {
        updated += 1;
        break;
      }
      if (!/duplicate|unique/i.test(error.message)) break;
    }
  }
  return updated;
}
