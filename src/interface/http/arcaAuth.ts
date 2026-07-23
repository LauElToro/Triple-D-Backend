import type { Organization } from "@prisma/client";
import {
  authenticateApiKey,
  enforcePlanCap,
  meterUsage,
  type ApiKeyContext,
} from "./apiKeyAuth";
import {
  requireUser,
  resolveOrgContext,
  requirePermission,
  requireKycApproved,
} from "./session";
import type { Permission } from "./permissions";

export interface ArcaContext {
  org: Organization;
  viaKey: boolean;
  apiCtx?: ApiKeyContext;
  consumedBefore: number;
}

function hasApiKey(req: Request): boolean {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && auth.slice(7).startsWith("tdk_")) return true;
  return Boolean(req.headers.get("x-api-key"));
}

/**
 * Authorize an ARCA request via either an SDK API Key (metered) or a
 * dashboard session with the required permission. Returns the org and, for key
 * requests, everything needed to record usage afterwards.
 */
export async function authorizeArca(req: Request, permission: Permission): Promise<ArcaContext> {
  if (hasApiKey(req)) {
    const apiCtx = await authenticateApiKey(req);
    const consumedBefore = await enforcePlanCap(apiCtx);
    return { org: apiCtx.org, viaKey: true, apiCtx, consumedBefore };
  }

  const user = await requireUser(req);
  requireKycApproved(user);
  const ctx = await resolveOrgContext(req, user);
  requirePermission(ctx, permission);
  return { org: ctx.org, viaKey: false, consumedBefore: 0 };
}

/** Record a metered unit when the request came through an API Key. */
export async function meterArca(
  ctx: ArcaContext,
  endpoint: string,
  method: string,
  statusCode: number,
  units = 1
): Promise<void> {
  if (!ctx.viaKey || !ctx.apiCtx) return;
  await meterUsage({
    ctx: ctx.apiCtx,
    endpoint,
    method,
    statusCode,
    consumedBefore: ctx.consumedBefore,
    units,
  });
}
