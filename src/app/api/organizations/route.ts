import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, resolveOrgContext, requirePermission } from "@/interface/http/session";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, error, handleError } from "@/interface/http/responses";
import { publicOrg } from "@/interface/http/serializers";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(1).optional(),
  arcaCuit: z.string().regex(/^\d{11}$/,"CUIT debe tener 11 dígitos").optional(),
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

    const org = await prisma.organization.update({
      where: { id: ctx.org.id },
      data: parsed.data,
    });
    await audit({ actorId: user.id, action: "org.updated", target: org.id, metadata: parsed.data, ip: clientIp(req) });
    return ok({ organization: publicOrg(org, ctx.membership) });
  } catch (err) {
    return handleError(err);
  }
}
