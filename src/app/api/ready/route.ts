import { buildHealthReport } from "@/infrastructure/health/checks";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Readiness: DB + ARCA must be healthy for deploy/load-balancer gates. */
export async function GET() {
  const { readiness, report } = await buildHealthReport();
  const status = readiness === "ok" ? 200 : 503;

  return NextResponse.json(
    {
      status: readiness,
      service: "set-api",
      time: report.checkedAt,
      checks: report.services
        .filter((s) => ["database", "arca", "backend-api"].includes(s.id))
        .map((s) => ({
          id: s.id,
          status: s.status,
          latencyMs: s.latencyMs,
          message: s.message,
        })),
      issues: report.issues.filter((i) =>
        /PostgreSQL|ARCA|Backend/i.test(i)
      ),
    },
    { status }
  );
}
