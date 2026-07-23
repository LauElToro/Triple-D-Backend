import { cookies } from "next/headers";
import { revokeRefreshToken } from "@/application/auth/session-service";
import { REFRESH_COOKIE, clearRefreshCookie } from "@/interface/http/cookies";
import { ok, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

export async function POST() {
  try {
    const store = await cookies();
    const token = store.get(REFRESH_COOKIE)?.value;
    if (token) await revokeRefreshToken(token);
    const res = ok({ status: "logged_out" });
    clearRefreshCookie(res);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
