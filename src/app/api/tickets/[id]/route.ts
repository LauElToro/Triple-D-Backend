import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/interface/http/session";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

async function loadTicketForUser(id: string, userId: string, isSuper: boolean) {
  if (isSuper) return prisma.ticket.findUnique({ where: { id } });
  const membership = await prisma.membership.findFirst({ where: { userId, status: "ACTIVE" } });
  const orgIds = (
    await prisma.membership.findMany({ where: { userId, status: "ACTIVE" }, select: { orgId: true } })
  ).map((m) => m.orgId);
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket || !membership || !orgIds.includes(ticket.orgId)) return null;
  return ticket;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser(req);
    const ticket = await loadTicketForUser(id, user.id, user.systemRole === "SUPERADMIN");
    if (!ticket) return error(404, "Ticket no encontrado", "not_found");

    const messages = await prisma.ticketMessage.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { email: true, name: true } } },
    });
    return ok({
      ticket: { id: ticket.id, subject: ticket.subject, status: ticket.status, priority: ticket.priority, category: ticket.category },
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        isStaff: m.isStaff,
        author: m.author.name ?? m.author.email,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  message: z.string().min(1).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser(req);
    const isSuper = user.systemRole === "SUPERADMIN";
    const ticket = await loadTicketForUser(id, user.id, isSuper);
    if (!ticket) return error(404, "Ticket no encontrado", "not_found");

    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(422, "Datos inválidos", "unprocessable");

    if (parsed.data.message) {
      await prisma.ticketMessage.create({
        data: { ticketId: id, authorId: user.id, body: parsed.data.message, isStaff: isSuper },
      });
    }
    const updated = await prisma.ticket.update({
      where: { id },
      data: {
        status: parsed.data.status ?? ticket.status,
        priority: parsed.data.priority ?? ticket.priority,
      },
    });
    await audit({ actorId: user.id, action: "ticket.updated", target: id, ip: clientIp(req) });
    return ok({ ticket: { id: updated.id, status: updated.status, priority: updated.priority } });
  } catch (err) {
    return handleError(err);
  }
}
