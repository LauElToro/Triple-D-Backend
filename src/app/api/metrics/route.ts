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
      logins30,
      byService,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.apiKey.count({ where: { status: "active" } }),
      prisma.organization.groupBy({ by: ["planId"], _count: true }),
      prisma.organization.groupBy({ by: ["clientType"], _count: true }),
      prisma.organization.groupBy({ by: ["source"], _count: true }),
      prisma.usageRecord.aggregate({
        where: { createdAt: { gte: since30 } },
        _sum: { units: true, cost: true, providerCost: true },
      }),
      prisma.ticket.groupBy({ by: ["status"], _count: true }),
      prisma.organization.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          name: true,
          planId: true,
          kycStatus: true,
          source: true,
          createdAt: true,
          owner: { select: { email: true, lastLoginAt: true } },
        },
      }),
      prisma.user.count({ where: { kycStatus: "APPROVED" } }),
      prisma.loginEvent.count({ where: { createdAt: { gte: since30 } } }),
      prisma.usageRecord.groupBy({
        by: ["service"],
        where: { createdAt: { gte: since30 } },
        _sum: { units: true, cost: true, providerCost: true },
        _count: true,
      }),
    ]);

    const fixedCount = byPlan.find((p) => p.planId === "fixed")?._count ?? 0;
    const usageSpend = Number(usageAgg._sum.cost ?? 0);
    const providerCost = Number(usageAgg._sum.providerCost ?? 0);
    const mrr = fixedCount * PLANS.fixed.monthlyFee + usageSpend;

    const topServices = byService
      .map((s) => {
        const revenue = Number(s._sum.cost ?? 0);
        const cost = Number(s._sum.providerCost ?? 0);
        return {
          service: s.service ?? "other",
          calls: s._count,
          units: s._sum.units ?? 0,
          revenue,
          providerCost: cost,
          margin: revenue - cost,
        };
      })
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);

    return ok({
      totals: {
        clients: totalOrgs,
        users: totalUsers,
        activeKeys,
        kycApproved,
        unitsLast30: usageAgg._sum.units ?? 0,
        spendLast30: usageSpend,
        providerCostLast30: providerCost,
        marginLast30: usageSpend - providerCost,
        mrr,
        loginsLast30: logins30,
      },
      byPlan: byPlan.map((p) => ({ planId: p.planId, count: p._count })),
      byClientType: byType.map((t) => ({ type: t.clientType ?? "standard", count: t._count })),
      bySource: bySource.map((s) => ({ source: s.source ?? "direct", count: s._count })),
      ticketsByStatus: ticketsByStatus.map((t) => ({ status: t.status, count: t._count })),
      topServices,
      recentClients: recentOrgs.map((o) => ({
        id: o.id,
        name: o.name,
        planId: o.planId,
        kycStatus: o.kycStatus,
        source: o.source,
        owner: o.owner.email,
        lastLoginAt: o.owner.lastLoginAt,
        createdAt: o.createdAt,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
