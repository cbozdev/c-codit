import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_PATHS = ["/admin"];
const CUSTOMER_PATHS = ["/account", "/dashboard"];

// Routes that get rate-limited (windowSeconds, maxRequests)
const RATE_LIMITED: Record<string, [number, number]> = {
  "/api/auth/register": [900, 10],
  "/api/auth/forgot-password": [900, 5],
  "/api/auth/reset-password": [900, 10],
  "/api/contact": [3600, 5],
};

async function applyRateLimit(
  req: NextRequest,
  windowSeconds: number,
  maxRequests: number
): Promise<NextResponse | null> {
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  try {
    const { checkRateLimit, rateLimitHeaders } = await import("@/lib/rate-limit");
    const result = await checkRateLimit(ip, {
      windowSeconds,
      maxRequests,
      keyPrefix: req.nextUrl.pathname.replace(/\//g, "-"),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: rateLimitHeaders(result) }
      );
    }
  } catch {
    // Fail open when rate limiter is unavailable
  }
  return null;
}

export default auth(async function middleware(
  req: NextRequest & { auth: Awaited<ReturnType<typeof auth>> }
) {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Rate limit sensitive API routes
  const rateLimitConfig = RATE_LIMITED[pathname];
  if (rateLimitConfig) {
    const limited = await applyRateLimit(req, rateLimitConfig[0], rateLimitConfig[1]);
    if (limited) return limited;
  }

  const isAdminPath = ADMIN_PATHS.some((p) => pathname.startsWith(p));
  const isCustomerPath = CUSTOMER_PATHS.some((p) => pathname.startsWith(p));

  if (isAdminPath) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/auth/login?next=" + pathname, req.url));
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (isCustomerPath && !session?.user) {
    return NextResponse.redirect(new URL("/auth/login?next=" + pathname, req.url));
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/account/:path*",
    "/dashboard/:path*",
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)",
  ],
};
