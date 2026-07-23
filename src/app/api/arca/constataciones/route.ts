import { authorizeArca, meterArca } from "@/interface/http/arcaAuth";
import { callArca } from "@/infrastructure/arca/client";
import { ok, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ctx = await authorizeArca(req, "arca:write");
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const result = await callArca({ method: "POST", path: "/api/constataciones", body });
    await meterArca(ctx, "/arca/constataciones", "POST", result.status);

    if (!result.ok) return error(result.status, "Error en constatación", "arca_error", result.data);
    return ok(result.data);
  } catch (err) {
    return handleError(err);
  }
}
