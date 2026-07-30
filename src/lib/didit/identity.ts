import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { DiditValidationError } from "@/lib/didit/errors";

export interface DiditDecisionLike {
  raw?: Record<string, unknown>;
}

export interface DiditStaffBinding {
  organizationId: string;
  diditIdentityKey: string | null;
  diditEnrollmentSessionId: string | null;
  faceEnrolledAt: string | null;
}

/** Normalized document identity from Didit id_verifications (stable across sessions). */
export function extractDiditIdentityKey(decision: DiditDecisionLike): string | null {
  const idVerifications = decision.raw?.id_verifications;
  if (!Array.isArray(idVerifications) || idVerifications.length === 0) return null;

  const first = idVerifications[0] as Record<string, unknown>;
  const docType = String(first.document_type || first.documentType || "")
    .trim()
    .toLowerCase();
  const docNum = String(first.document_number || "").trim().toLowerCase();
  const personalNum = String(first.personal_number || "").trim().toLowerCase();

  if (!docNum && !personalNum) return null;

  return `${docType}|${docNum}|${personalNum}`;
}

export function hashDiditIdentityKey(identityKey: string): string {
  return createHash("sha256").update(identityKey).digest("hex");
}

export function resolveDiditIdentityHash(decision: DiditDecisionLike): string | null {
  const key = extractDiditIdentityKey(decision);
  return key ? hashDiditIdentityKey(key) : null;
}

function collectDiditMatchVendorIds(decision: DiditDecisionLike, staffId: string): string[] {
  const vendorIds = new Set<string>();
  const blocks = [
    decision.raw?.id_verifications,
    decision.raw?.face_matches,
    decision.raw?.nfc_verifications,
  ];

  for (const block of blocks) {
    if (!Array.isArray(block)) continue;
    for (const item of block) {
      const matches = (item as Record<string, unknown>).matches;
      if (!Array.isArray(matches)) continue;
      for (const match of matches) {
        const vendorData = String((match as Record<string, unknown>).vendor_data || "").trim();
        if (vendorData && vendorData !== staffId) vendorIds.add(vendorData);
      }
    }
  }

  return Array.from(vendorIds);
}

export async function getStaffDiditBinding(staffId: string): Promise<DiditStaffBinding | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("organization_id, didit_identity_key, didit_enrollment_session_id, face_enrolled_at")
    .eq("id", staffId)
    .maybeSingle();

  if (!data?.organization_id) return null;

  return {
    organizationId: data.organization_id,
    diditIdentityKey: data.didit_identity_key ?? null,
    diditEnrollmentSessionId: data.didit_enrollment_session_id ?? null,
    faceEnrolledAt: data.face_enrolled_at ?? null,
  };
}

export async function findEnrolledStaffWithDiditIdentity(
  organizationId: string,
  identityHash: string,
  excludeStaffId: string
): Promise<{ staffId: string; fullName: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("organization_id", organizationId)
    .eq("didit_identity_key", identityHash)
    .neq("id", excludeStaffId)
    .not("face_enrolled_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (!data?.id) return null;
  return { staffId: data.id, fullName: data.full_name || "another staff member" };
}

async function findEnrolledOrgStaffByIds(
  organizationId: string,
  staffIds: string[],
  excludeStaffId: string
): Promise<{ staffId: string; fullName: string } | null> {
  if (staffIds.length === 0) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("organization_id", organizationId)
    .in("id", staffIds)
    .neq("id", excludeStaffId)
    .not("face_enrolled_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (!data?.id) return null;
  return { staffId: data.id, fullName: data.full_name || "another staff member" };
}

export async function assertNoDiditMatchConflict(input: {
  organizationId: string;
  staffId: string;
  decision: DiditDecisionLike;
}): Promise<void> {
  const matchVendorIds = collectDiditMatchVendorIds(input.decision, input.staffId);
  const matchConflict = await findEnrolledOrgStaffByIds(
    input.organizationId,
    matchVendorIds,
    input.staffId
  );
  if (matchConflict) {
    throw new DiditValidationError(
      "Didit matched this verification to another staff account in your organization."
    );
  }
}

export async function assertDiditIdentityAvailableForStaff(input: {
  organizationId: string;
  staffId: string;
  decision: DiditDecisionLike;
}): Promise<string> {
  const identityHash = resolveDiditIdentityHash(input.decision);
  if (!identityHash) {
    throw new DiditValidationError(
      "Could not read identity from Didit verification. Use a KYC workflow with ID verification."
    );
  }

  const duplicate = await findEnrolledStaffWithDiditIdentity(
    input.organizationId,
    identityHash,
    input.staffId
  );
  if (duplicate) {
    throw new DiditValidationError(
      "This identity is already verified for another staff account in your organization."
    );
  }

  const matchVendorIds = collectDiditMatchVendorIds(input.decision, input.staffId);
  const matchConflict = await findEnrolledOrgStaffByIds(
    input.organizationId,
    matchVendorIds,
    input.staffId
  );
  if (matchConflict) {
    throw new DiditValidationError(
      "Didit matched this verification to another staff account in your organization."
    );
  }

  return identityHash;
}

function faceMatchUsesEnrollmentSession(
  decision: DiditDecisionLike,
  enrollmentSessionId: string
): boolean {
  const faceMatches = decision.raw?.face_matches;
  if (!Array.isArray(faceMatches) || faceMatches.length === 0) return false;

  return faceMatches.some((item) => {
    const sourceSessionId = String(
      (item as Record<string, unknown>).source_image_session_id || ""
    );
    return sourceSessionId === enrollmentSessionId;
  });
}

/** Clock: live verification must match the identity bound at portal enrollment. */
export async function assertDiditClockMatchesEnrollment(input: {
  staffId: string;
  decision: DiditDecisionLike;
  binding: DiditStaffBinding;
}): Promise<void> {
  if (!input.binding.faceEnrolledAt) {
    throw new DiditValidationError("Complete Didit KYC in the staff portal first.");
  }

  const clockIdentityHash = resolveDiditIdentityHash(input.decision);

  if (input.binding.diditIdentityKey) {
    if (clockIdentityHash) {
      if (clockIdentityHash !== input.binding.diditIdentityKey) {
        throw new DiditValidationError(
          "Didit identity does not match the staff member enrolled in the portal."
        );
      }
      return;
    }

    if (input.binding.diditEnrollmentSessionId) {
      if (faceMatchUsesEnrollmentSession(input.decision, input.binding.diditEnrollmentSessionId)) {
        return;
      }
      throw new DiditValidationError(
        "Face verification does not match this staff member's enrolled identity."
      );
    }

    throw new DiditValidationError(
      "Staff identity binding is incomplete. Re-verify in the staff portal."
    );
  }

  // Legacy profiles enrolled before identity binding.
  if (!input.binding.diditIdentityKey) {
    if (input.binding.diditEnrollmentSessionId) {
      if (faceMatchUsesEnrollmentSession(input.decision, input.binding.diditEnrollmentSessionId)) {
        return;
      }
      throw new DiditValidationError(
        "Face verification does not match this staff member's enrolled identity."
      );
    }

    if (clockIdentityHash) {
      const duplicate = await findEnrolledStaffWithDiditIdentity(
        input.binding.organizationId,
        clockIdentityHash,
        input.staffId
      );
      if (duplicate) {
        throw new DiditValidationError(
          "This identity is already verified for another staff account in your organization."
        );
      }
    }

    throw new DiditValidationError(
      "Staff identity binding is incomplete. Re-verify in the staff portal."
    );
  }
}
