import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, resolveOrgContext, requirePermission } from "@/interface/http/session";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

// SECURITY: sub-roles are the only mutable role field for members. OWNER/ADMIN
// org-roles and systemRole can never be assigned through this endpoint, so a
// member cannot be escalated to owner/admin or gain platform-wide privileges.
const schema = z.object({
  subRole: z.enum(["DEV", "CONTABILIDAD", "ADMINISTRACION"]).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser(req);
    const ctx = await resolveOrgContext(req, user);
    requirePermission(ctx, "team:write");

    const target = await prisma.membership.findFirst({ where: { id, orgId: ctx.org.id } });
    if (!target) return error(404, "Miembro no encontrado", "not_found");
    if (target.orgRole === "OWNER") {
      return error(403, "No se puede modificar al propietario", "cannot_modify_owner");
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(422, "Datos inválidos", "unprocessable");

    const updated = await prisma.membership.update({
      where: { id },
      data: {
        subRole: parsed.data.subRole ?? target.subRole,
        status: parsed.data.status ?? target.status,
      },
    });
    await audit({
      actorId: user.id,
      action: "team.member_updated",
      target: id,
      metadata: { subRole: updated.subRole, status: updated.status },
      ip: clientIp(req),
    });
    return ok({ id: updated.id, subRole: updated.subRole, status: updated.status });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser(req);
    const ctx = await resolveOrgContext(req, user);
    requirePermission(ctx, "team:write");

    const target = await prisma.membership.findFirst({ where: { id, orgId: ctx.org.id } });
    if (!target) return error(404, "Miembro no encontrado", "not_found");
    if (target.orgRole === "OWNER") {
      return error(403, "No se puede eliminar al propietario", "cannot_remove_owner");
    }

    await prisma.membership.delete({ where: { id } });
    await audit({ actorId: user.id, action: "team.member_removed", target: id, ip: clientIp(req) });
    return ok({ status: "removed" });
  } catch (err) {
    return handleError(err);
  }
}
