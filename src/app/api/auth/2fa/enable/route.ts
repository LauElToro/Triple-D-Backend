import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/interface/http/session";
import { verifyTotp } from "@/infrastructure/security/totp";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

const schema = z.object({ code: z.string().min(6).max(8), enable: z.boolean().default(true) });

/** Confirm the TOTP code and toggle 2FA on/off for the user. */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(422, "Datos inválidos", "unprocessable");

    if (parsed.data.enable) {
      if (!user.twoFactorSecret) return error(400, "Configurá 2FA primero", "no_secret");
      if (!verifyTotp(parsed.data.code, user.twoFactorSecret)) {
        return error(400, "Código inválido", "invalid_code");
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: true },
      });
      await audit({ actorId: user.id, action: "auth.2fa.enabled", ip: clientIp(req) });
      return ok({ twoFactorEnabled: true });
    }

    // Disable: require a valid current code.
    if (!user.twoFactorSecret || !verifyTotp(parsed.data.code, user.twoFactorSecret)) {
      return error(400, "Código inválido", "invalid_code");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    await audit({ actorId: user.id, action: "auth.2fa.disabled", ip: clientIp(req) });
    return ok({ twoFactorEnabled: false });
  } catch (err) {
    return handleError(err);
  }
}
