import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/interface/http/session";
import { sha256 } from "@/infrastructure/security/tokens";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().min(10) });

/**
 * Accept an invitation. The authenticated user's email must match the invite,
 * preventing a member from joining an org they were not invited to.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(422, "Datos inválidos", "unprocessable");

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash: sha256(parsed.data.token) },
    });
    if (!invitation || invitation.status !== "PENDING") {
      return error(400, "Invitación inválida", "invalid_invitation");
    }
    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } });
      return error(400, "Invitación vencida", "expired");
    }
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return error(403, "La invitación es para otro email", "email_mismatch");
    }

    await prisma.$transaction([
      prisma.membership.upsert({
        where: { userId_orgId: { userId: user.id, orgId: invitation.orgId } },
        update: { subRole: invitation.subRole, status: "ACTIVE", orgRole: "MEMBER" },
        create: {
          userId: user.id,
          orgId: invitation.orgId,
          orgRole: "MEMBER",
          subRole: invitation.subRole,
          status: "ACTIVE",
        },
      }),
      prisma.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } }),
    ]);

    await audit({ actorId: user.id, action: "team.invitation_accepted", target: invitation.orgId, ip: clientIp(req) });
    return ok({ status: "joined", orgId: invitation.orgId, subRole: invitation.subRole });
  } catch (err) {
    return handleError(err);
  }
}
