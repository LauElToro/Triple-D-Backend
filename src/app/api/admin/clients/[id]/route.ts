import { prisma } from "@/lib/prisma";
import { requireUser, requireSystemRole } from "@/interface/http/session";
import { ok, error, handleError } from "@/interface/http/responses";
import { publicInvoice, publicApiKey } from "@/interface/http/serializers";

export const runtime = "nodejs";

/** Full client detail for SUPERADMIN: hierarchy, usage, onboarding, invoices. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    requireSystemRole(user, ["SUPERADMIN"]);
    const { id } = await params;

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            kycStatus: true,
            lastLoginAt: true,
            createdAt: true,
            systemRole: true,
          },
        },
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                kycStatus: true,
                lastLoginAt: true,
                systemRole: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        apiKeys: { orderBy: { createdAt: "desc" } },
        invoices: { orderBy: { issuedAt: "desc" }, take: 20 },
      },
    });

    if (!org) return error(404, "Cliente no encontrado", "not_found");

    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [usageAgg, byService] = await Promise.all([
      prisma.usageRecord.aggregate({
        where: { orgId: id, createdAt: { gte: since30 } },
        _sum: { units: true, cost: true, providerCost: true },
      }),
      prisma.usageRecord.groupBy({
        by: ["service"],
        where: { orgId: id, createdAt: { gte: since30 } },
        _sum: { units: true, cost: true, providerCost: true },
        _count: true,
      }),
    ]);

    return ok({
      client: {
        id: org.id,
        name: org.name,
        planId: org.planId,
        kycStatus: org.kycStatus,
        arcaCuit: org.arcaCuit,
        clientType: org.clientType,
        source: org.source,
        heardAbout: org.heardAbout,
        intendedUse: org.intendedUse,
        companyRole: org.companyRole,
        companySize: org.companySize,
        onboardingCompletedAt: org.onboardingCompletedAt,
        createdAt: org.createdAt,
      },
      owner: org.owner,
      members: org.memberships.map((m) => ({
        id: m.id,
        orgRole: m.orgRole,
        subRole: m.subRole,
        status: m.status,
        user: m.user,
      })),
      keys: org.apiKeys.map(publicApiKey),
      invoices: org.invoices.map(publicInvoice),
      usage30d: {
        units: usageAgg._sum.units ?? 0,
        revenue: Number(usageAgg._sum.cost ?? 0),
        providerCost: Number(usageAgg._sum.providerCost ?? 0),
        margin:
          Number(usageAgg._sum.cost ?? 0) - Number(usageAgg._sum.providerCost ?? 0),
        byService: byService.map((s) => ({
          service: s.service ?? "other",
          calls: s._count,
          units: s._sum.units ?? 0,
          revenue: Number(s._sum.cost ?? 0),
          providerCost: Number(s._sum.providerCost ?? 0),
          margin: Number(s._sum.cost ?? 0) - Number(s._sum.providerCost ?? 0),
        })),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
