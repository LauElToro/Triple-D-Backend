const CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

export interface CycleWindow {
  periodStart: Date;
  periodEnd: Date;
  cycleIndex: number;
}

/**
 * 30-day billing cycles anchored on the API key's usageStartedAt.
 */
export function getCycleWindow(usageStartedAt: Date, now: Date = new Date()): CycleWindow {
  const anchor = usageStartedAt.getTime();
  const nowMs = now.getTime();
  const elapsed = Math.max(0, nowMs - anchor);
  const cycleIndex = Math.floor(elapsed / CYCLE_MS);
  const periodStart = new Date(anchor + cycleIndex * CYCLE_MS);
  const periodEnd = new Date(anchor + (cycleIndex + 1) * CYCLE_MS);
  return { periodStart, periodEnd, cycleIndex };
}

export function getCycleWindowAtIndex(usageStartedAt: Date, index: number): CycleWindow {
  const anchor = usageStartedAt.getTime();
  const periodStart = new Date(anchor + index * CYCLE_MS);
  const periodEnd = new Date(anchor + (index + 1) * CYCLE_MS);
  return { periodStart, periodEnd, cycleIndex: index };
}

export { CYCLE_MS };
