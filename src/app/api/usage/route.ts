import { prisma } from "@/lib/prisma";
import { requireUser, resolveOrgContext, requirePermission } from "@/interface/http/session";
import { getCycleWindow } from "@/domain/billing-cycle";
import { getPlan } from "@/domain/plans";
import { ok, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const ctx = await resolveOrgContext(req, user);
    requirePermission(ctx, "usage:read");

    const plan = getPlan(ctx.org.planId);

    const activeKey = await prisma.apiKey.findFirst({
      where: { orgId: ctx.org.id, status: { in: ["active", "suspended"] } },
      orderBy: { createdAt: "desc" },
    });

    const cycleStart = activeKey
      ? getCycleWindow(activeKey.usageStartedAt).periodStart
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

    const [cycleAgg, records] = await Promise.all([
      prisma.usageRecord.aggregate({
        where: { orgId: ctx.org.id, createdAt: { gte: cycleStart } },
        _sum: { units: true, cost: true },
      }),
      prisma.usageRecord.findMany({
        where: { orgId: ctx.org.id, createdAt: { gte: sevenDaysAgo } },
        select: { units: true, createdAt: true },
      }),
    ]);

    const days: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setUTCDate(sevenDaysAgo.getUTCDate() + i);
      days[isoDate(d)] = 0;
    }
    for (const r of records) {
      const key = isoDate(r.createdAt);
      if (key in days) days[key] = (days[key] ?? 0) + r.units;
    }
    const daily = Object.entries(days).map(([day, count]) => ({ day, count }));

    const units = cycleAgg._sum.units ?? 0;
    const unlimited = plan.cap === Number.POSITIVE_INFINITY;
    return ok({
      plan: {
        id: plan.id,
        name: plan.name,
        cap: unlimited ? null : plan.cap,
        includedUnits: plan.includedUnits,
        unitCost: plan.unitCost,
      },
      cycle: {
        units,
        cost: Number(cycleAgg._sum.cost ?? 0),
        remaining: unlimited ? null : Math.max(0, plan.cap - units),
      },
      daily,
    });
  } catch (err) {
    return handleError(err);
  }
}
