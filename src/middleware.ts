import { NextResponse, type NextRequest } from "next/server";

/**
 * CORS for the browser frontend.
 *
 * - Handles the preflight (OPTIONS) that any authenticated request triggers
 *   (custom headers Authorization / X-Org-Id make requests non-simple).
 * - Echoes a single allowed origin (required when credentials are included;
 *   "*" is not valid with cookies).
 * - Production: strict allowlist from WEB_APP_URL (comma-separated for prod +
 *   preview domains). Development: any localhost/127.0.0.1 origin, any port.
 *
 * Non-browser SDK clients (API key auth) send no Origin header and are unaffected.
 */

const ALLOWED_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization, X-Api-Key, X-Org-Id";

function resolveAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null;

  const allowlist = (process.env.WEB_APP_URL || "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowlist.includes(origin)) return origin;

  if (process.env.NODE_ENV !== "production") {
    try {
      const { hostname } = new URL(origin);
      if (hostname === "localhost" || hostname === "127.0.0.1") return origin;
    } catch {
      /* ignore malformed origin */
    }
  }
  return null;
}

export function middleware(req: NextRequest) {
  const allowed = resolveAllowedOrigin(req.headers.get("origin"));

  const cors = new Headers();
  if (allowed) {
    cors.set("Access-Control-Allow-Origin", allowed);
    cors.set("Access-Control-Allow-Credentials", "true");
    cors.set("Vary", "Origin");
  }
  cors.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  cors.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: cors });
  }

  const res = NextResponse.next();
  cors.forEach((value, key) => res.headers.set(key, value));
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
