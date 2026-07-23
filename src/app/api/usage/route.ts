import { prisma } from "@/lib/prisma";
import { requireUser, resolveOrgContext, requirePermission } from "@/interface/http/session";
import { getPlan } from "@/domain/plans";
import { ok, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const ctx = await resolveOrgContext(req, user);
    requirePermission(ctx, "usage:read");

    const plan = getPlan(ctx.org.planId);
    const cycleStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [cycleAgg, records] = await Promise.all([
      prisma.usageRecord.aggregate({
        where: { orgId: ctx.org.id, createdAt: { gte: cycleStart } },
        _sum: { units: true, cost: true },
      }),
      prisma.usageRecord.findMany({
        where: { orgId: ctx.org.id, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        select: { units: true, createdAt: true },
      }),
    ]);

    // Daily breakdown for the last 7 days.
    const days: Record<string, number> = {};
    const labels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    for (const r of records) {
      const key = labels[r.createdAt.getDay()];
      days[key] = (days[key] ?? 0) + r.units;
    }
    const daily = labels.map((day) => ({ day, count: days[day] ?? 0 }));

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
