import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const REFRESH_COOKIE = "sa_refresh";

// In production the frontend and API live on different domains (Vercel), so the
// refresh cookie must be SameSite=None + Secure to be sent on cross-site fetches.
// Locally (http, same-site localhost) Lax works and avoids the Secure requirement.
const SAME_SITE = env.isProd ? "none" : "lax";

export function setRefreshCookie(res: NextResponse, token: string) {
  res.cookies.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: SAME_SITE,
    path: "/",
    maxAge: env.refreshTokenTtlSeconds,
  });
}

export function clearRefreshCookie(res: NextResponse) {
  res.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure: env.isProd,
    sameSite: SAME_SITE,
    path: "/",
    maxAge: 0,
  });
}
