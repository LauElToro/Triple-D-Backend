import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionClaims } from "@/interface/http/session";
import { verifyTotp } from "@/infrastructure/security/totp";
import { verifyOtp } from "@/application/auth/otp-service";
import { issueSession } from "@/application/auth/session-service";
import { setRefreshCookie } from "@/interface/http/cookies";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, error, handleError } from "@/interface/http/responses";
import { publicUser } from "@/interface/http/serializers";

export const runtime = "nodejs";

const schema = z.object({ code: z.string().min(6).max(8) });

/**
 * Completes a login that requires 2FA. The caller must present the pending
 * access token (issued by /auth/login) as a Bearer token.
 */
export async function POST(req: Request) {
  try {
    const claims = await getSessionClaims(req);
    if (!claims?.sub || !claims.twoFactorPending) {
      return error(401, "Desafío 2FA inválido", "twofa_invalid");
    }
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(422, "Datos inválidos", "unprocessable");

    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user) return error(401, "No autenticado", "unauthorized");

    let valid = false;
    if (user.twoFactorSecret) {
      valid = verifyTotp(parsed.data.code, user.twoFactorSecret);
    }
    if (!valid) {
      valid = await verifyOtp(user.id, "LOGIN_2FA", parsed.data.code);
    }
    if (!valid) return error(400, "Código inválido o vencido", "invalid_code");

    const session = await issueSession(user);
    await audit({ actorId: user.id, action: "auth.login.2fa_success", ip: clientIp(req) });

    const res = ok({
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      user: publicUser(user),
    });
    setRefreshCookie(res, session.refreshToken);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
