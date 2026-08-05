import { prisma } from "@/lib/prisma";

/**
 * Reactivate suspended API keys when the org has no overdue invoices.
 */
export async function reactivateOrgKeys(orgId: string): Promise<number> {
  const overdue = await prisma.invoice.count({
    where: { orgId, status: "overdue" },
  });
  if (overdue > 0) return 0;

  const res = await prisma.apiKey.updateMany({
    where: { orgId, status: "suspended" },
    data: { status: "active" },
  });
  return res.count;
}
