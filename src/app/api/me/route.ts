import { prisma } from "@/lib/prisma";
import { requireUser } from "@/interface/http/session";
import { ok, handleError } from "@/interface/http/responses";
import { publicUser, publicOrg } from "@/interface/http/serializers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const memberships = await prisma.membership.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      include: { org: true },
      orderBy: { createdAt: "asc" },
    });

    // SUPERADMIN may not have a membership; expose owned orgs if any.
    const orgs = memberships.map((m) => publicOrg(m.org, m));
    const requestedOrgId = req.headers.get("x-org-id");
    const activeOrg =
      (requestedOrgId ? orgs.find((o) => o.id === requestedOrgId) : undefined) ??
      orgs[0] ??
      null;

    return ok({
      user: publicUser(user),
      organizations: orgs,
      activeOrg,
    });
  } catch (err) {
    return handleError(err);
  }
}
