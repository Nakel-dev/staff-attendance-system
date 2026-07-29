export type BiometricProvider = "didit";

export const BIOMETRIC_PROVIDERS: BiometricProvider[] = ["didit"];

export const BIOMETRIC_PROVIDER_LABELS: Record<BiometricProvider, string> = {
  didit: "Didit",
};

export const BIOMETRIC_PROVIDER_HINTS: Record<BiometricProvider, string> = {
  didit: "Didit KYC once in portal; Didit verification again on every kiosk clock-in/out",
};

/** All legacy DB values map to Didit. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function normalizeBiometricProvider(_value?: unknown): BiometricProvider {
  return "didit";
}

export function isBiometricProviderReady(
  opts: { diditConfigured: boolean }
): boolean {
  return opts.diditConfigured;
}
