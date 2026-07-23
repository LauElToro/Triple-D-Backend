import { prisma } from "@/lib/prisma";
import { requireUser, requireSystemRole } from "@/interface/http/session";
import { ok, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

/** Login traffic analytics for SUPERADMIN. */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    requireSystemRole(user, ["SUPERADMIN"]);

    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const events = await prisma.loginEvent.findMany({
      where: { createdAt: { gte: since30 } },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        user: { select: { email: true, name: true } },
        org: { select: { id: true, name: true, planId: true } },
      },
    });

    const byDay: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    const byReferrer: Record<string, number> = {};
    const byLanding: Record<string, number> = {};

    for (const e of events) {
      const day = e.createdAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
      const country = e.country || "unknown";
      byCountry[country] = (byCountry[country] ?? 0) + 1;
      const ref = e.referrer || "direct";
      byReferrer[ref] = (byReferrer[ref] ?? 0) + 1;
      const land = e.landingPath || "/";
      byLanding[land] = (byLanding[land] ?? 0) + 1;
    }

    const toSorted = (map: Record<string, number>, limit = 10) =>
      Object.entries(map)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

    const daily = Object.entries(byDay)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day));

    return ok({
      totals: { logins30d: events.length },
      daily,
      byCountry: toSorted(byCountry),
      byReferrer: toSorted(byReferrer),
      byLanding: toSorted(byLanding),
      recent: events.slice(0, 40).map((e) => ({
        id: e.id,
        email: e.user.email,
        name: e.user.name,
        org: e.org?.name ?? null,
        planId: e.org?.planId ?? null,
        country: e.country,
        ip: e.ip,
        referrer: e.referrer,
        landingPath: e.landingPath,
        utmSource: e.utmSource,
        createdAt: e.createdAt,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
