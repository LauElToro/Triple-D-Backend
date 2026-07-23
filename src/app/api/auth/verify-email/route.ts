import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyOtp } from "@/application/auth/otp-service";
import { issueSession } from "@/application/auth/session-service";
import { setRefreshCookie } from "@/interface/http/cookies";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, error, handleError } from "@/interface/http/responses";
import { publicUser } from "@/interface/http/serializers";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(422, "Datos inválidos", "unprocessable");

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase().trim() },
    });
    if (!user) return error(404, "Usuario no encontrado", "not_found");

    const valid = await verifyOtp(user.id, "EMAIL_VERIFY", parsed.data.code);
    if (!valid) return error(400, "Código inválido o vencido", "invalid_code");

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    const session = await issueSession(updated);
    await audit({ actorId: user.id, action: "auth.email_verified", ip: clientIp(req) });

    const res = ok({
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      user: publicUser(updated),
    });
    setRefreshCookie(res, session.refreshToken);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
