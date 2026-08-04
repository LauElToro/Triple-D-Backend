import { buildHealthReport } from "@/infrastructure/health/checks";
import { requireUser, requireSystemRole } from "@/interface/http/session";
import { handleError, ok } from "@/interface/http/responses";

export const runtime = "nodejs";

/** Operational health dashboard for SUPERADMIN owners. */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    requireSystemRole(user, ["SUPERADMIN"]);

    const { report } = await buildHealthReport();

    const platform = report.services.filter((s) => s.group === "platform");
    const apis = report.services.filter((s) => s.group === "api");
    const integrations = report.services.filter((s) => s.group === "integration");

    const avgLatency =
      report.services
        .filter((s) => s.latencyMs !== null)
        .reduce((sum, s) => sum + (s.latencyMs ?? 0), 0) /
      Math.max(1, report.services.filter((s) => s.latencyMs !== null).length);

    return ok({
      status: report.status,
      checkedAt: report.checkedAt,
      summary: {
        ok: report.services.filter((s) => s.status === "ok").length,
        degraded: report.services.filter((s) => s.status === "degraded").length,
        down: report.services.filter((s) => s.status === "down").length,
        avgLatencyMs: Math.round(avgLatency),
      },
      platform,
      apis,
      integrations,
      issues: report.issues,
    });
  } catch (err) {
    return handleError(err);
  }
}
