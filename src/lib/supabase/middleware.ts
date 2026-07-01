import { NextResponse, type NextRequest } from "next/server";
import { AUTH_PATH } from "@/constants";
import { rateLimit } from "@/lib/security/rate-limit";
import { createServerClient } from "@supabase/ssr";

const ADMIN_ROUTES = [
  "/dashboard",
  "/staff",
  "/attendance",
  "/leaves",
  "/reports",
  "/settings",
  "/review-queue",
];

const STAFF_ROUTES = ["/my-attendance"];
const SHARED_ROUTES = ["/profile", "/my-leaves"];
const PUBLIC_ROUTES = ["/", AUTH_PATH, "/login", "/register", "/terms", "/privacy", "/kiosk"];
const KIOSK_API_PREFIX = "/api/kiosk";
const AUTH_SUBROUTES = ["/auth/reset-password", "/auth/callback"];
const AUTH_RATE_LIMIT_POST_PATHS = [AUTH_PATH, "/auth/reset-password"];
const AUTH_RATE_LIMIT_EXEMPT = ["/auth/callback"];

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export async function updateSession(request: NextRequest) {
  const requestId = crypto.randomUUID();
  let supabaseResponse = NextResponse.next({ request });
  supabaseResponse.headers.set("x-request-id", requestId);

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith(KIOSK_API_PREFIX) || pathname.startsWith("/kiosk")) {
    return supabaseResponse;
  }

  const isAuthRateLimitExempt = AUTH_RATE_LIMIT_EXEMPT.some((path) =>
    pathname.startsWith(path)
  );
  const shouldRateLimitAuthPost =
    request.method === "POST" &&
    !isAuthRateLimitExempt &&
    AUTH_RATE_LIMIT_POST_PATHS.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );

  if (shouldRateLimitAuthPost) {
    const ip = getClientIp(request);
    const limit = rateLimit(`auth-post:${ip}:${pathname}`, 30, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait and try again." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limit.retryAfterSec),
            "x-request-id": requestId,
          },
        }
      );
    }
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (
    origin &&
    host &&
    request.method === "POST" &&
    !origin.includes(host) &&
    !origin.includes("localhost")
  ) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403, headers: { "x-request-id": requestId } }
    );
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          supabaseResponse.headers.set("x-request-id", requestId);
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute =
    PUBLIC_ROUTES.includes(pathname) || AUTH_SUBROUTES.some((r) => pathname.startsWith(r));
  const isAuthRoute =
    pathname === AUTH_PATH || pathname === "/login" || pathname === "/register";

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = AUTH_PATH;
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("x-request-id", requestId);
    return redirect;
  }

  if (user && isAuthRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role) {
      const url = request.nextUrl.clone();
      url.pathname =
        profile.role === "admin" ? "/dashboard" : "/my-attendance";
      const redirect = NextResponse.redirect(url);
      redirect.headers.set("x-request-id", requestId);
      return redirect;
    }

    return supabaseResponse;
  }

  if (user && !isPublicRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      const url = request.nextUrl.clone();
      url.pathname = AUTH_PATH;
      url.searchParams.set("error", "profile-not-found");
      const redirect = NextResponse.redirect(url);
      redirect.headers.set("x-request-id", requestId);
      return redirect;
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = AUTH_PATH;
      url.searchParams.set("error", "account-disabled");
      const redirect = NextResponse.redirect(url);
      redirect.headers.set("x-request-id", requestId);
      return redirect;
    }

    const role = profile.role;

    if (SHARED_ROUTES.some((r) => pathname.startsWith(r))) {
      return supabaseResponse;
    }

    if (role === "staff" && ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
      const url = request.nextUrl.clone();
      url.pathname = "/my-attendance";
      const redirect = NextResponse.redirect(url);
      redirect.headers.set("x-request-id", requestId);
      return redirect;
    }

    if (role === "admin" && STAFF_ROUTES.some((r) => pathname.startsWith(r))) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      const redirect = NextResponse.redirect(url);
      redirect.headers.set("x-request-id", requestId);
      return redirect;
    }
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    if (!user) {
      url.pathname = AUTH_PATH;
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      url.pathname =
        profile?.role === "admin" ? "/dashboard" : "/my-attendance";
    }
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("x-request-id", requestId);
    return redirect;
  }

  return supabaseResponse;
}
