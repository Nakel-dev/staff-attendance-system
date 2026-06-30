import { headers } from "next/headers";

/** Production URL used when email links must not point at localhost. */
export const PRODUCTION_APP_URL =
  "https://staff-attendance-system-tau.vercel.app";

function normalizeUrl(url: string) {
  return url.replace(/\/$/, "");
}

/**
 * Resolve the public app URL for the current request (server-side).
 */
export async function getAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL
    ? normalizeUrl(process.env.NEXT_PUBLIC_APP_URL)
    : undefined;

  if (configured && !configured.includes("localhost")) {
    return configured;
  }

  try {
    const headersList = await headers();
    const host =
      headersList.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      headersList.get("host");

    if (host && !host.includes("localhost")) {
      const proto = headersList.get("x-forwarded-proto") || "https";
      return normalizeUrl(`${proto}://${host}`);
    }
  } catch {
    // headers() is unavailable outside a request (scripts, etc.)
  }

  if (process.env.VERCEL_URL) {
    return normalizeUrl(`https://${process.env.VERCEL_URL}`);
  }

  if (configured) return configured;

  return "http://localhost:3000";
}

/**
 * Password reset emails must use a public HTTPS URL Supabase can redirect to.
 */
export async function getPasswordResetAppUrl() {
  const requestUrl = await getAppUrl();

  if (!requestUrl.includes("localhost")) {
    return requestUrl;
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL
    ? normalizeUrl(process.env.NEXT_PUBLIC_APP_URL)
    : undefined;

  if (configured && !configured.includes("localhost")) {
    return configured;
  }

  return PRODUCTION_APP_URL;
}
