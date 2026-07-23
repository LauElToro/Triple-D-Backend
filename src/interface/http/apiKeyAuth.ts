import type { ApiKey, Organization } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashApiKey, looksLikeApiKey } from "@/infrastructure/security/apiKey";
import { getPlan, unitCostFor } from "@/domain/plans";
import { HttpError } from "./responses";

export interface ApiKeyContext {
  apiKey: ApiKey;
  org: Organization;
}

function extractKey(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (looksLikeApiKey(token)) return token;
  }
  const x = req.headers.get("x-api-key");
  if (x && looksLikeApiKey(x)) return x;
  return null;
}

/**
 * Authenticate an SDK request by API Key. Rejects unknown/suspended/revoked keys.
 */
export async function authenticateApiKey(req: Request): Promise<ApiKeyContext> {
  const plaintext = extractKey(req);
  if (!plaintext) throw new HttpError(401, "API Key requerida", "api_key_required");

  const keyHash = hashApiKey(plaintext);
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { org: true },
  });

  if (!apiKey) throw new HttpError(401, "API Key inválida", "invalid_api_key");
  if (apiKey.status === "revoked") throw new HttpError(401, "API Key revocada", "revoked_api_key");
  if (apiKey.status === "suspended") {
    throw new HttpError(402, "Servicio suspendido por falta de pago", "suspended");
  }

  return { apiKey, org: apiKey.org };
}

function currentCycleStart(apiKey: ApiKey): Date {
  // 30-day cycles anchored on usageStartedAt.
  const start = apiKey.usageStartedAt.getTime();
  const now = Date.now();
  const cycleMs = 30 * 24 * 60 * 60 * 1000;
  const elapsed = Math.max(0, now - start);
  const cyclesPassed = Math.floor(elapsed / cycleMs);
  return new Date(start + cyclesPassed * cycleMs);
}

/**
 * Enforce plan cap for the current cycle. Throws 402 if the cap is exceeded.
 * Returns the number of units already consumed in the cycle.
 */
export async function enforcePlanCap(ctx: ApiKeyContext): Promise<number> {
  const plan = getPlan(ctx.org.planId);
  const cycleStart = currentCycleStart(ctx.apiKey);

  const agg = await prisma.usageRecord.aggregate({
    where: { orgId: ctx.org.id, createdAt: { gte: cycleStart } },
    _sum: { units: true },
  });
  const consumed = agg._sum.units ?? 0;

  if (consumed >= plan.cap) {
    throw new HttpError(
      402,
      "Límite del plan alcanzado para este ciclo",
      "plan_cap_reached",
      { plan: plan.id, cap: plan.cap, consumed }
    );
  }
  return consumed;
}

/**
 * Record a metered unit for this request, pricing it against the plan.
 */
export async function meterUsage(params: {
  ctx: ApiKeyContext;
  endpoint: string;
  method: string;
  statusCode: number;
  consumedBefore: number;
  units?: number;
}): Promise<void> {
  const units = params.units ?? 1;
  const cost = unitCostFor(params.ctx.org.planId, params.consumedBefore) * units;

  await prisma.$transaction([
    prisma.usageRecord.create({
      data: {
        apiKeyId: params.ctx.apiKey.id,
        orgId: params.ctx.org.id,
        endpoint: params.endpoint,
        method: params.method,
        units,
        cost,
        statusCode: params.statusCode,
      },
    }),
    prisma.apiKey.update({
      where: { id: params.ctx.apiKey.id },
      data: { lastUsedAt: new Date() },
    }),
  ]);
}
