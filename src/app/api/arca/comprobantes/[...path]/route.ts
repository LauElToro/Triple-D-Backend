import { authorizeArca, meterArca } from "@/interface/http/arcaAuth";
import { callArca } from "@/infrastructure/arca/client";
import { ok, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

/**
 * Read-through proxy for comprobante lookups, e.g.
 *   GET /api/arca/comprobantes/{tipo}/{ptoVta}/{nro}?cuit_emisor=
 *   GET /api/arca/comprobantes/ultimo/{tipo}/{ptoVta}?cuit_emisor=
 */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const ctx = await authorizeArca(req, "arca:read");

    const url = new URL(req.url);
    const cuitEmisor = url.searchParams.get("cuit_emisor") ?? ctx.org.arcaCuit ?? undefined;

    const result = await callArca({
      method: "GET",
      path: `/api/comprobantes/${path.join("/")}`,
      query: { cuit_emisor: cuitEmisor },
    });
    await meterArca(ctx, `/arca/comprobantes/${path.join("/")}`, "GET", result.status);

    if (!result.ok) return error(result.status, "Error consultando comprobante", "arca_error", result.data);
    return ok(result.data);
  } catch (err) {
    return handleError(err);
  }
}
