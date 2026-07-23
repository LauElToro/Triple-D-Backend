import { prisma } from "@/lib/prisma";
import { requireUser, requireSystemRole } from "@/interface/http/session";
import { ok, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

/** Revenue vs estimated provider cost by ARCA service. */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    requireSystemRole(user, ["SUPERADMIN"]);

    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [byService, totals] = await Promise.all([
      prisma.usageRecord.groupBy({
        by: ["service"],
        where: { createdAt: { gte: since30 } },
        _sum: { units: true, cost: true, providerCost: true },
        _count: true,
      }),
      prisma.usageRecord.aggregate({
        where: { createdAt: { gte: since30 } },
        _sum: { units: true, cost: true, providerCost: true },
      }),
    ]);

    const services = byService
      .map((s) => {
        const revenue = Number(s._sum.cost ?? 0);
        const providerCost = Number(s._sum.providerCost ?? 0);
        return {
          service: s.service ?? "other",
          calls: s._count,
          units: s._sum.units ?? 0,
          revenue,
          providerCost,
          margin: revenue - providerCost,
          marginPct: revenue > 0 ? ((revenue - providerCost) / revenue) * 100 : null,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const revenue = Number(totals._sum.cost ?? 0);
    const providerCost = Number(totals._sum.providerCost ?? 0);

    return ok({
      periodDays: 30,
      totals: {
        units: totals._sum.units ?? 0,
        revenue,
        providerCost,
        margin: revenue - providerCost,
        marginPct: revenue > 0 ? ((revenue - providerCost) / revenue) * 100 : null,
      },
      services,
    });
  } catch (err) {
    return handleError(err);
  }
}
