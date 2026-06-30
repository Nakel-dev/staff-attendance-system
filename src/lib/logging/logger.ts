const SENSITIVE_KEYS = [
  "password",
  "token",
  "authorization",
  "cookie",
  "secret",
  "service_role",
  "apikey",
  "face_descriptor",
  "checkin_token",
  "invite_code",
];

function maskValue(key: string, value: unknown): unknown {
  const lower = key.toLowerCase();
  if (SENSITIVE_KEYS.some((part) => lower.includes(part))) {
    return "[REDACTED]";
  }
  if (typeof value === "string" && value.length > 120) {
    return `${value.slice(0, 20)}…[truncated]`;
  }
  return value;
}

export function maskSensitive<T extends Record<string, unknown>>(payload: T): T {
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      masked[key] = maskSensitive(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      masked[key] = value.map((item) =>
        item && typeof item === "object"
          ? maskSensitive(item as Record<string, unknown>)
          : maskValue(key, item)
      );
    } else {
      masked[key] = maskValue(key, value);
    }
  }
  return masked as T;
}

export function logInfo(event: string, payload: Record<string, unknown> = {}) {
  console.info(
    JSON.stringify({
      level: "info",
      event,
      timestamp: new Date().toISOString(),
      ...maskSensitive(payload),
    })
  );
}

export function logError(event: string, payload: Record<string, unknown> = {}) {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      timestamp: new Date().toISOString(),
      ...maskSensitive(payload),
    })
  );
}
