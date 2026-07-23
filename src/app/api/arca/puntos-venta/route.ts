import { authorizeArca, meterArca } from "@/interface/http/arcaAuth";
import { callArca } from "@/infrastructure/arca/client";
import { ok, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const ctx = await authorizeArca(req, "arca:read");
    const url = new URL(req.url);
    const cuitEmisor = url.searchParams.get("cuit_emisor") ?? ctx.org.arcaCuit ?? undefined;

    const result = await callArca({
      method: "GET",
      path: "/api/puntos-venta",
      query: { cuit_emisor: cuitEmisor },
    });
    await meterArca(ctx, "/arca/puntos-venta", "GET", result.status);

    if (!result.ok) return error(result.status, "Error consultando puntos de venta", "arca_error", result.data);
    return ok(result.data);
  } catch (err) {
    return handleError(err);
  }
}
