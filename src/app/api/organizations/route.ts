import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, resolveOrgContext, requirePermission } from "@/interface/http/session";
import { audit, clientIp } from "@/interface/http/audit";
import { validateCuit, normalizeCuit } from "@/lib/cuit";
import { ok, error, handleError } from "@/interface/http/responses";
import { publicOrg } from "@/interface/http/serializers";
import type { PlanId } from "@prisma/client";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(1).optional(),
  arcaCuit: z.string().min(1).optional(),
  planId: z.enum(["free", "fixed", "usage"]).optional(),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const ctx = await resolveOrgContext(req, user);
    return ok({ organization: publicOrg(ctx.org, ctx.membership) });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser(req);
    const ctx = await resolveOrgContext(req, user);
    requirePermission(ctx, "org:manage");

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(422, "Datos inválidos", "unprocessable", parsed.error.flatten());

    const { planId, arcaCuit, name } = parsed.data;

    if (arcaCuit !== undefined) {
      const normalized = normalizeCuit(arcaCuit);
      if (!validateCuit(normalized)) {
        return error(422, "CUIT inválido", "invalid_cuit");
      }
    }

    const updateData: {
      name?: string;
      arcaCuit?: string;
      planId?: PlanId;
      pendingPlanId?: PlanId | null;
      planStatus?: "active" | "pending_payment";
    } = {};

    if (name !== undefined) updateData.name = name;
    if (arcaCuit !== undefined) updateData.arcaCuit = normalizeCuit(arcaCuit);

    if (planId !== undefined) {
      if (planId === "free") {
        updateData.planId = "free";
        updateData.pendingPlanId = null;
        updateData.planStatus = "active";
      } else if (user.systemRole === "SUPERADMIN") {
        updateData.planId = planId;
        updateData.pendingPlanId = null;
        updateData.planStatus = "active";
      } else if (ctx.org.planId === planId && ctx.org.planStatus === "active") {
        // Already on this paid plan.
      } else {
        const approved = await prisma.payment.findFirst({
          where: {
            orgId: ctx.org.id,
            status: "approved",
            metadata: { path: ["planId"], equals: planId },
          },
        });
        if (approved) {
          updateData.planId = planId;
          updateData.pendingPlanId = null;
          updateData.planStatus = "active";
        } else {
          updateData.pendingPlanId = planId;
          updateData.planStatus = "pending_payment";
        }
      }
    }

    const org = await prisma.organization.update({
      where: { id: ctx.org.id },
      data: updateData,
    });
    await audit({ actorId: user.id, action: "org.updated", target: org.id, metadata: updateData, ip: clientIp(req) });
    return ok({ organization: publicOrg(org, ctx.membership) });
  } catch (err) {
    return handleError(err);
  }
}
