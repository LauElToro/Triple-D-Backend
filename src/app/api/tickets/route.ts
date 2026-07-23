import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, resolveOrgContext, requirePermission } from "@/interface/http/session";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, created, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

const createSchema = z.object({
  subject: z.string().min(3),
  category: z.string().min(1).default("general"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  body: z.string().min(1),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    // SUPERADMIN sees every ticket across the platform for support triage.
    if (user.systemRole === "SUPERADMIN") {
      const tickets = await prisma.ticket.findMany({
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        include: { org: { select: { name: true } }, author: { select: { email: true } } },
      });
      return ok({
        tickets: tickets.map((t) => ({
          id: t.id,
          subject: t.subject,
          category: t.category,
          status: t.status,
          priority: t.priority,
          org: t.org.name,
          author: t.author.email,
          updatedAt: t.updatedAt,
          createdAt: t.createdAt,
        })),
      });
    }

    const ctx = await resolveOrgContext(req, user);
    requirePermission(ctx, "tickets:read");
    const tickets = await prisma.ticket.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { updatedAt: "desc" },
    });
    return ok({
      tickets: tickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        category: t.category,
        status: t.status,
        priority: t.priority,
        updatedAt: t.updatedAt,
        createdAt: t.createdAt,
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
    requirePermission(ctx, "tickets:write");

    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(422, "Datos inválidos", "unprocessable", parsed.error.flatten());

    const ticket = await prisma.ticket.create({
      data: {
        orgId: ctx.org.id,
        authorId: user.id,
        subject: parsed.data.subject,
        category: parsed.data.category,
        priority: parsed.data.priority,
        messages: {
          create: { authorId: user.id, body: parsed.data.body, isStaff: false },
        },
      },
    });
    await audit({ actorId: user.id, action: "ticket.created", target: ticket.id, ip: clientIp(req) });
    return created({ ticket: { id: ticket.id, subject: ticket.subject, status: ticket.status } });
  } catch (err) {
    return handleError(err);
  }
}
