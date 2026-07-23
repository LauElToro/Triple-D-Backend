import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { requireUser } from "@/interface/http/session";
import { createDiditSession } from "@/infrastructure/kyc/didit";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

/** Create (or return) a Didit KYC session for the authenticated user. */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    const session = await createDiditSession({
      vendorData: user.id,
      callbackUrl: `${env.webAppUrl}/kyc/complete`,
    });

    await prisma.kycSession.create({
      data: {
        userId: user.id,
        diditSessionId: session.session_id,
        status: "PENDING",
        url: session.url,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { kycStatus: user.kycStatus === "APPROVED" ? "APPROVED" : "PENDING" },
    });

    await audit({ actorId: user.id, action: "kyc.session_created", ip: clientIp(req) });
    return ok({ url: session.url, sessionId: session.session_id, status: "PENDING" });
  } catch (err) {
    return handleError(err);
  }
}
