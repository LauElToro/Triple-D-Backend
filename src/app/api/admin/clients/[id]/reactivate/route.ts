import { prisma } from "@/lib/prisma";
import { requireUser, requireSystemRole } from "@/interface/http/session";
import { reactivateOrgKeys } from "@/application/billing/reactivate";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

/** Reactivate suspended API keys when the org has no overdue invoices. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    requireSystemRole(user, ["SUPERADMIN"]);
    const { id } = await params;

    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) return error(404, "Cliente no encontrado", "not_found");

    const overdue = await prisma.invoice.count({
      where: { orgId: id, status: "overdue" },
    });
    if (overdue > 0) {
      return error(409, "Hay facturas vencidas sin saldar", "overdue_invoices");
    }

    const reactivated = await reactivateOrgKeys(id);

    await audit({
      actorId: user.id,
      action: "admin.client.reactivate",
      target: id,
      metadata: { reactivated },
      ip: clientIp(req),
    });

    return ok({ reactivated });
  } catch (err) {
    return handleError(err);
  }
}
