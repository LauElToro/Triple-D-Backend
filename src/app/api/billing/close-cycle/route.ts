import { z } from "zod";
import { requireUser, requireSystemRole, resolveOrgContext } from "@/interface/http/session";
import { closeBillingCycleForOrg, suspendOverdueOrgs } from "@/application/billing/close-cycle";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, handleError } from "@/interface/http/responses";
import { publicInvoice } from "@/interface/http/serializers";

export const runtime = "nodejs";

const schema = z.object({ orgId: z.string().uuid().optional(), suspendOverdue: z.boolean().optional() });

/** Close the current cycle and emit an invoice. SUPERADMIN or org OWNER only. */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    const orgId = parsed.success ? parsed.data.orgId : undefined;

    let targetOrgId = orgId;
    if (user.systemRole !== "SUPERADMIN") {
      const ctx = await resolveOrgContext(req, user);
      if (ctx.membership?.orgRole !== "OWNER") requireSystemRole(user, ["SUPERADMIN"]);
      targetOrgId = ctx.org.id;
    }
    if (!targetOrgId) requireSystemRole(user, ["SUPERADMIN"]);

    const invoice = await closeBillingCycleForOrg(targetOrgId!);
    let suspended = 0;
    if (parsed.success && parsed.data.suspendOverdue && user.systemRole === "SUPERADMIN") {
      suspended = await suspendOverdueOrgs();
    }

    await audit({ actorId: user.id, action: "billing.cycle_closed", target: invoice.id, ip: clientIp(req) });
    return ok({ invoice: publicInvoice(invoice), suspended });
  } catch (err) {
    return handleError(err);
  }
}
