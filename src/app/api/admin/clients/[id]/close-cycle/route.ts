import { prisma } from "@/lib/prisma";
import { requireUser, requireSystemRole } from "@/interface/http/session";
import { closeBillingCycleForOrg } from "@/application/billing/close-cycle";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, error, handleError } from "@/interface/http/responses";
import { publicInvoice } from "@/interface/http/serializers";

export const runtime = "nodejs";

/** Close the current billing cycle for a client org. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    requireSystemRole(user, ["SUPERADMIN"]);
    const { id } = await params;

    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) return error(404, "Cliente no encontrado", "not_found");

    const invoice = await closeBillingCycleForOrg(id);
    if (!invoice) {
      return ok({ message: "No hay ciclo pendiente de cierre", invoice: null });
    }

    await audit({
      actorId: user.id,
      action: "admin.billing.close_cycle",
      target: id,
      metadata: { invoiceId: invoice.id },
      ip: clientIp(req),
    });

    return ok({ invoice: publicInvoice(invoice) });
  } catch (err) {
    return handleError(err);
  }
}
