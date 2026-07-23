import { prisma } from "@/lib/prisma";
import { requireUser, resolveOrgContext, requirePermission } from "@/interface/http/session";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

/** Revoke an API key. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser(req);
    const ctx = await resolveOrgContext(req, user);
    requirePermission(ctx, "keys:write");

    const key = await prisma.apiKey.findFirst({ where: { id, orgId: ctx.org.id } });
    if (!key) return error(404, "API Key no encontrada", "not_found");

    await prisma.apiKey.update({
      where: { id },
      data: { status: "revoked", revokedAt: new Date() },
    });
    await audit({ actorId: user.id, action: "keys.revoked", target: id, ip: clientIp(req) });
    return ok({ status: "revoked" });
  } catch (err) {
    return handleError(err);
  }
}
