import { prisma } from "@/lib/prisma";
import { requireUser, resolveOrgContext, requirePermission } from "@/interface/http/session";
import { ok, handleError } from "@/interface/http/responses";
import { publicInvoice } from "@/interface/http/serializers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const ctx = await resolveOrgContext(req, user);
    requirePermission(ctx, "invoices:read");

    const invoices = await prisma.invoice.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { issuedAt: "desc" },
    });
    return ok({ invoices: invoices.map(publicInvoice) });
  } catch (err) {
    return handleError(err);
  }
}
