import { prisma } from "@/lib/prisma";
import { requireUser } from "@/interface/http/session";
import { ok, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const latest = await prisma.kycSession.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return ok({
      kycStatus: user.kycStatus,
      session: latest ? { id: latest.diditSessionId, url: latest.url, status: latest.status } : null,
    });
  } catch (err) {
    return handleError(err);
  }
}
