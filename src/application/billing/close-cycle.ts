import { prisma } from "@/lib/prisma";
import { getPlan } from "@/domain/plans";

/**
 * Close a 30-day billing cycle for an organization and emit an immutable
 * invoice for the metered spend. Fixed plans bill the flat monthly fee; usage
 * plans bill accumulated metered cost; free plans emit a zero invoice.
 */
export async function closeBillingCycleForOrg(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Organization not found");

  const plan = getPlan(org.planId);
  const now = new Date();
  const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const agg = await prisma.usageRecord.aggregate({
    where: { orgId, createdAt: { gte: periodStart, lte: now } },
    _sum: { units: true, cost: true },
  });
  const units = agg._sum.units ?? 0;
  const meteredCost = Number(agg._sum.cost ?? 0);

  const amount = plan.id === "fixed" ? plan.monthlyFee : meteredCost;
  const dueAt = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15-day grace

  const cycle = await prisma.billingCycle.create({
    data: { orgId, startsAt: periodStart, endsAt: now, status: "closed" },
  });

  const invoice = await prisma.invoice.create({
    data: {
      orgId,
      cycleId: cycle.id,
      periodStart,
      periodEnd: now,
      amount,
      units,
      status: amount === 0 ? "paid" : "pending",
      dueAt,
      paidAt: amount === 0 ? now : null,
    },
  });

  return invoice;
}

/**
 * Suspend keys whose invoices are overdue past the 15-day grace period.
 */
export async function suspendOverdueOrgs(): Promise<number> {
  const now = new Date();
  const overdue = await prisma.invoice.findMany({
    where: { status: "pending", dueAt: { lt: now } },
    select: { id: true, orgId: true },
  });
  let suspended = 0;
  for (const inv of overdue) {
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: "overdue" } });
    const res = await prisma.apiKey.updateMany({
      where: { orgId: inv.orgId, status: "active" },
      data: { status: "suspended" },
    });
    suspended += res.count;
  }
  return suspended;
}
