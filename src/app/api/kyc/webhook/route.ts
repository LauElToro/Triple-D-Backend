import { prisma } from "@/lib/prisma";
import { verifyDiditSignature, mapDiditStatus } from "@/infrastructure/kyc/didit";
import { audit } from "@/interface/http/audit";
import { ok, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

/**
 * Didit webhook (v3). Verifies X-Signature-V2 over the raw body, then applies
 * the KYC decision to the user and their organizations.
 */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const signature =
      req.headers.get("x-signature-v2") ??
      req.headers.get("x-signature") ??
      req.headers.get("X-Signature-V2");

    if (!verifyDiditSignature(raw, signature)) {
      return error(401, "Firma inválida", "invalid_signature");
    }

    const event = JSON.parse(raw) as {
      session_id?: string;
      vendor_data?: string;
      status?: string;
      event_id?: string;
    };

    const newStatus = mapDiditStatus(event.status);

    // Correlate by our session record or by vendor_data (userId).
    const kycSession = event.session_id
      ? await prisma.kycSession.findUnique({ where: { diditSessionId: event.session_id } })
      : null;
    const userId = kycSession?.userId ?? event.vendor_data;
    if (!userId) return ok({ received: true, matched: false });

    if (kycSession) {
      await prisma.kycSession.update({
        where: { id: kycSession.id },
        data: { status: newStatus },
      });
    }

    await prisma.user.update({ where: { id: userId }, data: { kycStatus: newStatus } });
    await prisma.organization.updateMany({
      where: { ownerId: userId },
      data: { kycStatus: newStatus },
    });

    await audit({
      actorId: userId,
      action: "kyc.webhook",
      target: event.session_id,
      metadata: { status: newStatus },
    });

    return ok({ received: true, status: newStatus });
  } catch (err) {
    return handleError(err);
  }
}
