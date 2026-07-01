import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function generateApiKey(): string {
  return `kiosk_${randomBytes(32).toString("hex")}`;
}

export function generateSessionToken(): string {
  return randomBytes(48).toString("hex");
}

export function hashSecret(value: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(`${salt}:${value}`).digest("hex");
  return `${salt}:${hash}`;
}

export function verifySecret(value: string, stored: string): boolean {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = createHash("sha256").update(`${salt}:${value}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
