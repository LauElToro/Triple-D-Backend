import { z } from "zod";
import { loginUser } from "@/application/auth/auth-service";
import { issueSession, issuePendingAccessToken } from "@/application/auth/session-service";
import { setRefreshCookie } from "@/interface/http/cookies";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, error, handleError } from "@/interface/http/responses";
import { publicUser } from "@/interface/http/serializers";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(422, "Datos inválidos", "unprocessable");

    const result = await loginUser(parsed.data.email, parsed.data.password);

    if (result.twoFactorRequired) {
      const pendingToken = await issuePendingAccessToken(result.user);
      await audit({
        actorId: result.user.id,
        action: "auth.login.2fa_challenge",
        ip: clientIp(req),
      });
      return ok({
        status: "twofa_required",
        method: result.twoFactorMethod,
        pendingToken,
      });
    }

    const session = await issueSession(result.user);
    await audit({ actorId: result.user.id, action: "auth.login", ip: clientIp(req) });

    const res = ok({
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      user: publicUser(result.user),
    });
    setRefreshCookie(res, session.refreshToken);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
