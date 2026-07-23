import { prisma } from "@/lib/prisma";
import { requireUser, requireSystemRole } from "@/interface/http/session";
import { ok, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

/** Full client (organization) list for the SUPERADMIN console. */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    requireSystemRole(user, ["SUPERADMIN"]);

    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { email: true, name: true } },
        _count: { select: { apiKeys: true, memberships: true, tickets: true } },
      },
    });

    return ok({
      clients: orgs.map((o) => ({
        id: o.id,
        name: o.name,
        planId: o.planId,
        kycStatus: o.kycStatus,
        clientType: o.clientType,
        source: o.source,
        arcaCuit: o.arcaCuit,
        owner: o.owner.email,
        keys: o._count.apiKeys,
        members: o._count.memberships,
        tickets: o._count.tickets,
        createdAt: o.createdAt,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
