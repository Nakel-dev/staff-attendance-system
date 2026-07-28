export type BiometricProvider = "local" | "didit" | "aws";

export const BIOMETRIC_PROVIDERS: BiometricProvider[] = ["local", "didit", "aws"];

export const BIOMETRIC_PROVIDER_LABELS: Record<BiometricProvider, string> = {
  local: "Local (free)",
  didit: "Didit",
  aws: "AWS Rekognition",
};

export const BIOMETRIC_PROVIDER_HINTS: Record<BiometricProvider, string> = {
  local: "On-device face match only — no cloud bill",
  didit: "Third-party liveness + face match",
  aws: "Live check + CompareFaces (~$0.001/compare)",
};

export function normalizeBiometricProvider(value: unknown): BiometricProvider {
  if (value === "didit" || value === "aws" || value === "local") return value;
  return "aws";
}

/** Whether the deployment can run the org's chosen provider (no silent downgrade). */
export function isBiometricProviderReady(
  provider: BiometricProvider,
  opts: { awsConfigured: boolean; diditConfigured: boolean }
): boolean {
  if (provider === "aws") return opts.awsConfigured;
  if (provider === "didit") return opts.diditConfigured;
  return true;
}
