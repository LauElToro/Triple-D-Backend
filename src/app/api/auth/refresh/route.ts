import { cookies } from "next/headers";
import { rotateSession } from "@/application/auth/session-service";
import { REFRESH_COOKIE, setRefreshCookie, clearRefreshCookie } from "@/interface/http/cookies";
import { ok, error, handleError } from "@/interface/http/responses";
import { publicUser } from "@/interface/http/serializers";

export const runtime = "nodejs";

export async function POST() {
  try {
    const store = await cookies();
    const token = store.get(REFRESH_COOKIE)?.value;
    if (!token) return error(401, "Sin sesión", "no_session");

    const rotated = await rotateSession(token);
    if (!rotated) {
      const res = error(401, "Sesión expirada", "session_expired");
      clearRefreshCookie(res);
      return res;
    }

    const res = ok({
      accessToken: rotated.session.accessToken,
      expiresIn: rotated.session.expiresIn,
      user: publicUser(rotated.user),
    });
    setRefreshCookie(res, rotated.session.refreshToken);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
