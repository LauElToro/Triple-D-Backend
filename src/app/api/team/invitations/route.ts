import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { requireUser, resolveOrgContext, requirePermission } from "@/interface/http/session";
import { randomToken, sha256 } from "@/infrastructure/security/tokens";
import { sendMail } from "@/infrastructure/email/mailer";
import { invitationTemplate } from "@/infrastructure/email/templates";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, created, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  subRole: z.enum(["DEV", "CONTABILIDAD", "ADMINISTRACION"]).default("DEV"),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const ctx = await resolveOrgContext(req, user);
    requirePermission(ctx, "team:read");

    const invitations = await prisma.invitation.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
    });
    return ok({
      invitations: invitations.map((i) => ({
        id: i.id,
        email: i.email,
        subRole: i.subRole,
        status: i.status,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const ctx = await resolveOrgContext(req, user);
    requirePermission(ctx, "team:write");

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(422, "Datos inválidos", "unprocessable");

    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await prisma.invitation.create({
      data: {
        orgId: ctx.org.id,
        email: parsed.data.email.toLowerCase().trim(),
        subRole: parsed.data.subRole,
        orgRole: "MEMBER",
        tokenHash: sha256(token),
        invitedBy: user.id,
        expiresAt,
      },
    });

    const acceptUrl = `${env.webAppUrl}/invite/accept?token=${token}`;
    await sendMail({ to: invitation.email, ...invitationTemplate(ctx.org.name, acceptUrl, parsed.data.subRole) });
    await audit({ actorId: user.id, action: "team.invited", target: invitation.email, ip: clientIp(req) });

    return created({
      invitation: { id: invitation.id, email: invitation.email, subRole: invitation.subRole },
      // token is returned so it can also be shared manually in dev
      acceptUrl,
    });
  } catch (err) {
    return handleError(err);
  }
}
