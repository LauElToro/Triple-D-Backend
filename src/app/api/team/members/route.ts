import { prisma } from "@/lib/prisma";
import { requireUser, resolveOrgContext, requirePermission } from "@/interface/http/session";
import { permissionsFor } from "@/interface/http/permissions";
import { ok, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const ctx = await resolveOrgContext(req, user);
    requirePermission(ctx, "team:read");

    const members = await prisma.membership.findMany({
      where: { orgId: ctx.org.id },
      include: { user: { select: { id: true, email: true, name: true, kycStatus: true } } },
      orderBy: { createdAt: "asc" },
    });

    return ok({
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
        orgRole: m.orgRole,
        subRole: m.subRole,
        status: m.status,
        permissions: permissionsFor(m.orgRole, m.subRole),
        kycStatus: m.user.kycStatus,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
