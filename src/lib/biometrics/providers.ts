export type BiometricProvider = "local" | "didit" | "aws";

export const BIOMETRIC_PROVIDERS: BiometricProvider[] = ["local", "didit", "aws"];

export const BIOMETRIC_PROVIDER_LABELS: Record<BiometricProvider, string> = {
  local: "Local (free) — on-device face + motion liveness",
  didit: "Didit — cloud face match + liveness",
  aws: "AWS Rekognition — pay-as-you-go face match (~$0.001) + local liveness",
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
