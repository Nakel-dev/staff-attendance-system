export type BiometricProvider = "local" | "didit" | "faceplusplus";

export const BIOMETRIC_PROVIDERS: BiometricProvider[] = ["faceplusplus", "didit", "local"];

export const BIOMETRIC_PROVIDER_LABELS: Record<BiometricProvider, string> = {
  faceplusplus: "Face++",
  local: "Local (free)",
  didit: "Didit",
};

export const BIOMETRIC_PROVIDER_HINTS: Record<BiometricProvider, string> = {
  faceplusplus: "Portal face verification + kiosk Face++ compare (recommended)",
  local: "On-device face match only — no cloud bill",
  didit: "Third-party liveness + face match fallback",
};

/** Legacy org rows may still store "aws" — treat as Face++. */
export function normalizeBiometricProvider(value: unknown): BiometricProvider {
  if (value === "faceplusplus" || value === "didit" || value === "local") return value;
  if (value === "aws") return "faceplusplus";
  return "faceplusplus";
}

export function isBiometricProviderReady(
  provider: BiometricProvider,
  opts: { faceplusplusConfigured: boolean; diditConfigured: boolean }
): boolean {
  if (provider === "faceplusplus") return opts.faceplusplusConfigured;
  if (provider === "didit") return opts.diditConfigured;
  return true;
}
