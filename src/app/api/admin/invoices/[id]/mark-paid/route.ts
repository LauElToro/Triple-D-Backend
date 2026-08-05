import { requireUser, requireSystemRole } from "@/interface/http/session";
import { markInvoicePaid } from "@/application/billing/close-cycle";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, error, handleError } from "@/interface/http/responses";
import { publicInvoice, publicPayment } from "@/interface/http/serializers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** Mark an invoice as paid (manual), record payment, and reactivate org keys. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    requireSystemRole(user, ["SUPERADMIN"]);
    const { id } = await params;

    const invoice = await markInvoicePaid(id);
    const payment = await prisma.payment.findFirst({
      where: { invoiceId: id, status: "approved" },
      orderBy: { createdAt: "desc" },
    });

    await audit({
      actorId: user.id,
      action: "admin.invoice.mark_paid",
      target: id,
      ip: clientIp(req),
    });

    return ok({
      invoice: publicInvoice(invoice),
      payment: payment ? publicPayment(payment) : null,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Invoice not found") {
      return error(404, "Factura no encontrada", "not_found");
    }
    return handleError(err);
  }
}
