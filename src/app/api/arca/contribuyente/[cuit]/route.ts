import { authorizeArca, meterArca } from "@/interface/http/arcaAuth";
import { callArca } from "@/infrastructure/arca/client";
import { ok, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ cuit: string }> }) {
  try {
    const { cuit } = await params;
    const ctx = await authorizeArca(req, "arca:read");

    const result = await callArca({ method: "GET", path: `/api/contribuyente/${cuit}` });
    await meterArca(ctx, `/arca/contribuyente/${cuit}`, "GET", result.status);

    if (!result.ok) return error(result.status, "Error consultando ARCA", "arca_error", result.data);
    return ok(result.data);
  } catch (err) {
    return handleError(err);
  }
}
