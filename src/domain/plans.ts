export type PlanId = "free" | "fixed" | "usage";

export interface PlanConfig {
  id: PlanId;
  name: string;
  /** Monthly base fee in ARS. */
  monthlyFee: number;
  /** Cost per metered unit (comprobante) in ARS. */
  unitCost: number;
  /** Included units per cycle (0 = none, Infinity = unlimited). */
  includedUnits: number;
  /** Hard cap of units per cycle (Infinity = no cap). */
  cap: number;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    monthlyFee: 0,
    unitCost: 0,
    includedUnits: 50,
    cap: 50,
  },
  fixed: {
    id: "fixed",
    name: "Fijo",
    monthlyFee: 29900,
    unitCost: 0,
    includedUnits: 2000,
    cap: 2000,
  },
  usage: {
    id: "usage",
    name: "Por uso",
    monthlyFee: 0,
    unitCost: 22,
    includedUnits: 0,
    cap: Number.POSITIVE_INFINITY,
  },
};

export function getPlan(planId: string): PlanConfig {
  return PLANS[(planId as PlanId)] ?? PLANS.free;
}

/**
 * Cost of a single metered unit given how many units were already consumed
 * in the current cycle. Included units are free; beyond that unitCost applies.
 */
export function unitCostFor(planId: string, unitsConsumedInCycle: number): number {
  const plan = getPlan(planId);
  if (unitsConsumedInCycle < plan.includedUnits) return 0;
  return plan.unitCost;
}
