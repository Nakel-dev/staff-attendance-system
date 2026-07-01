import { hashSecret, verifySecret } from "@/lib/kiosk/crypto";

const PIN_PATTERN = /^\d{4}$/;

export function isValidKioskPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export function hashKioskPin(pin: string): string {
  if (!isValidKioskPin(pin)) {
    throw new Error("Kiosk PIN must be exactly 4 digits.");
  }
  return hashSecret(pin);
}

export function verifyKioskPin(pin: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !isValidKioskPin(pin)) return false;
  return verifySecret(pin, storedHash);
}
