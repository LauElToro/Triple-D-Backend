import { prisma } from "@/lib/prisma";
import type { Invoice, PlanId } from "@prisma/client";
import { getPlan } from "@/domain/plans";
import { getCycleWindowAtIndex, getCycleWindow } from "@/domain/billing-cycle";

/**
 * Close the oldest completed billing cycle without an invoice for an organization.
 * Returns null when there is nothing to close yet.
 */
export async function closeBillingCycleForOrg(orgId: string): Promise<Invoice | null> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Organization not found");

  const activeKey = await prisma.apiKey.findFirst({
    where: { orgId, status: { in: ["active", "suspended"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!activeKey) return null;

  const now = new Date();
  const { cycleIndex } = getCycleWindow(activeKey.usageStartedAt, now);
  if (cycleIndex === 0) return null;

  for (let i = 0; i < cycleIndex; i++) {
    const { periodStart, periodEnd } = getCycleWindowAtIndex(activeKey.usageStartedAt, i);

    const existing = await prisma.invoice.findFirst({
      where: { orgId, periodStart, periodEnd },
    });
    if (existing) continue;

    return createCycleInvoice(orgId, org.planId, periodStart, periodEnd);
  }

  return null;
}

async function createCycleInvoice(
  orgId: string,
  planId: PlanId,
  periodStart: Date,
  periodEnd: Date
): Promise<Invoice> {
  const plan = getPlan(planId);

  const agg = await prisma.usageRecord.aggregate({
    where: { orgId, createdAt: { gte: periodStart, lt: periodEnd } },
    _sum: { units: true, cost: true },
  });
  const units = agg._sum.units ?? 0;
  const meteredCost = Number(agg._sum.cost ?? 0);

  if (plan.id === "free" && units === 0) {
    return prisma.invoice.create({
      data: {
        orgId,
        periodStart,
        periodEnd,
        amount: 0,
        units: 0,
        status: "paid",
        dueAt: periodEnd,
        paidAt: periodEnd,
      },
    });
  }

  const amount = plan.id === "fixed" ? plan.monthlyFee : meteredCost;
  const dueAt = new Date(periodEnd.getTime() + 15 * 24 * 60 * 60 * 1000);

  const cycle = await prisma.billingCycle.create({
    data: { orgId, startsAt: periodStart, endsAt: periodEnd, status: "closed" },
  });

  return prisma.invoice.create({
    data: {
      orgId,
      cycleId: cycle.id,
      periodStart,
      periodEnd,
      amount,
      units,
      status: amount === 0 ? "paid" : "pending",
      dueAt,
      paidAt: amount === 0 ? periodEnd : null,
    },
  });
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

/**
 * Mark an invoice as paid, record a manual payment, and activate pending plan if applicable.
 */
export async function markInvoicePaid(invoiceId: string): Promise<Invoice> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { org: true },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "paid") return invoice;

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: "paid", paidAt: now },
    });

    await tx.payment.create({
      data: {
        invoiceId: inv.id,
        orgId: inv.orgId,
        provider: "manual",
        status: "approved",
        amount: inv.amount,
        approvedAt: now,
      },
    });

    const org = invoice.org;
    if (org.pendingPlanId && org.planStatus === "pending_payment") {
      await tx.organization.update({
        where: { id: org.id },
        data: {
          planId: org.pendingPlanId,
          pendingPlanId: null,
          planStatus: "active",
        },
      });
    }

    await tx.apiKey.updateMany({
      where: { orgId: inv.orgId, status: "suspended" },
      data: { status: "active" },
    });

    return inv;
  });

  return updated;
}
