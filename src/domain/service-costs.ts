/**
 * Estimated provider cost (ARS) per metered unit, by ARCA service.
 * Tune via env overrides when real provider pricing is known.
 */

export type ArcaService =
  | "comprobantes"
  | "constataciones"
  | "padron"
  | "puntos_venta"
  | "other";

const DEFAULT_PROVIDER_COST: Record<ArcaService, number> = {
  comprobantes: 2,
  constataciones: 1.5,
  padron: 0.5,
  puntos_venta: 0.3,
  other: 1,
};

function envCost(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function providerCostFor(service: ArcaService, units = 1): number {
  const map: Record<ArcaService, number> = {
    comprobantes: envCost("ARCA_COST_COMPROBANTES", DEFAULT_PROVIDER_COST.comprobantes),
    constataciones: envCost("ARCA_COST_CONSTATACIONES", DEFAULT_PROVIDER_COST.constataciones),
    padron: envCost("ARCA_COST_PADRON", DEFAULT_PROVIDER_COST.padron),
    puntos_venta: envCost("ARCA_COST_PUNTOS_VENTA", DEFAULT_PROVIDER_COST.puntos_venta),
    other: envCost("ARCA_COST_OTHER", DEFAULT_PROVIDER_COST.other),
  };
  return map[service] * units;
}

export function serviceFromEndpoint(endpoint: string): ArcaService {
  const path = endpoint.toLowerCase();
  if (path.includes("comprobante")) return "comprobantes";
  if (path.includes("constatacion")) return "constataciones";
  if (path.includes("contribuyente") || path.includes("padron")) return "padron";
  if (path.includes("puntos-venta") || path.includes("punto")) return "puntos_venta";
  return "other";
}
