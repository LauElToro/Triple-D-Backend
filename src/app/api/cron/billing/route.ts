import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { closeBillingCycleForOrg, suspendOverdueOrgs } from "@/application/billing/close-cycle";
import { getCycleWindow } from "@/domain/billing-cycle";
import { error, ok, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

function verifyCronSecret(req: Request): boolean {
  if (!env.cronSecret) return !env.isProd;
  return req.headers.get("authorization") === `Bearer ${env.cronSecret}`;
}

export async function GET(req: Request) {
  try {
    if (!verifyCronSecret(req)) {
      return error(401, "No autorizado", "unauthorized");
    }

    const now = new Date();
    const orgs = await prisma.organization.findMany({
      where: { apiKeys: { some: { status: { in: ["active", "suspended"] } } } },
      select: {
        id: true,
        apiKeys: {
          where: { status: { in: ["active", "suspended"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { usageStartedAt: true },
        },
      },
    });

    let closed = 0;
    for (const org of orgs) {
      const key = org.apiKeys[0];
      if (!key) continue;

      const { cycleIndex } = getCycleWindow(key.usageStartedAt, now);
      if (cycleIndex === 0) continue;

      const invoice = await closeBillingCycleForOrg(org.id);
      if (invoice) closed++;
    }

    const suspended = await suspendOverdueOrgs();

    return ok({ closed, suspended, ranAt: now.toISOString() });
  } catch (err) {
    return handleError(err);
  }
}
