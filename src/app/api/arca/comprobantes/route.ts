import { authorizeArca, meterArca } from "@/interface/http/arcaAuth";
import { callArca } from "@/infrastructure/arca/client";
import { ok, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

/**
 * Emit a comprobante (Factura / NC / ND) through ARCA. Uses the org's CUIT as
 * cuit_emisor unless one is supplied in the body.
 */
export async function POST(req: Request) {
  try {
    const ctx = await authorizeArca(req, "arca:write");
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (!body.cuit_emisor && ctx.org.arcaCuit) {
      body.cuit_emisor = ctx.org.arcaCuit;
    }
    if (!body.cuit_emisor) {
      return error(400, "Falta cuit_emisor (configurá el CUIT de la organización)", "missing_cuit");
    }

    const result = await callArca({ method: "POST", path: "/api/comprobantes", body });
    // A successful comprobante is one billable metered unit.
    await meterArca(ctx, "/arca/comprobantes", "POST", result.status, result.ok ? 1 : 0);

    if (!result.ok) return error(result.status, "Error emitiendo comprobante", "arca_error", result.data);
    return ok(result.data);
  } catch (err) {
    return handleError(err);
  }
}
