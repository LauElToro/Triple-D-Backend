import { prisma } from "@/lib/prisma";
import { requireUser, requireSystemRole } from "@/interface/http/session";
import { PLANS } from "@/domain/plans";
import { ok, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

/** Platform-wide KPIs for the SUPERADMIN dashboard. */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    requireSystemRole(user, ["SUPERADMIN"]);

    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalOrgs,
      totalUsers,
      activeKeys,
      byPlan,
      byType,
      bySource,
      usageAgg,
      ticketsByStatus,
      recentOrgs,
      kycApproved,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.apiKey.count({ where: { status: "active" } }),
      prisma.organization.groupBy({ by: ["planId"], _count: true }),
      prisma.organization.groupBy({ by: ["clientType"], _count: true }),
      prisma.organization.groupBy({ by: ["source"], _count: true }),
      prisma.usageRecord.aggregate({
        where: { createdAt: { gte: since30 } },
        _sum: { units: true, cost: true },
      }),
      prisma.ticket.groupBy({ by: ["status"], _count: true }),
      prisma.organization.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, name: true, planId: true, kycStatus: true, createdAt: true },
      }),
      prisma.user.count({ where: { kycStatus: "APPROVED" } }),
    ]);

    // Estimated MRR: fixed plans contribute their monthly fee; usage plans
    // contribute the last-30-day metered spend.
    const fixedCount = byPlan.find((p) => p.planId === "fixed")?._count ?? 0;
    const usageSpend = Number(usageAgg._sum.cost ?? 0);
    const mrr = fixedCount * PLANS.fixed.monthlyFee + usageSpend;

    return ok({
      totals: {
        clients: totalOrgs,
        users: totalUsers,
        activeKeys,
        kycApproved,
        unitsLast30: usageAgg._sum.units ?? 0,
        spendLast30: usageSpend,
        mrr,
      },
      byPlan: byPlan.map((p) => ({ planId: p.planId, count: p._count })),
      byClientType: byType.map((t) => ({ type: t.clientType ?? "standard", count: t._count })),
      bySource: bySource.map((s) => ({ source: s.source ?? "direct", count: s._count })),
      ticketsByStatus: ticketsByStatus.map((t) => ({ status: t.status, count: t._count })),
      recentClients: recentOrgs,
    });
  } catch (err) {
    return handleError(err);
  }
}
