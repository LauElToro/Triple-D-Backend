import { prisma } from "@/lib/prisma";
import { requireUser } from "@/interface/http/session";
import { generateTotpSecret, totpQrDataUrl } from "@/infrastructure/security/totp";
import { ok, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

/** Generate a TOTP secret + QR for the authenticated user (not yet enabled). */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret },
    });
    const qr = await totpQrDataUrl(user.email, secret);
    return ok({ secret, qr });
  } catch (err) {
    return handleError(err);
  }
}
