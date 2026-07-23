import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeArca } from "@/interface/http/arcaAuth";
import { ok, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

const updateSchema = z.object({
  description: z.string().min(1).optional(),
  sku: z.string().optional(),
  unitPrice: z.number().nonnegative().optional(),
  ivaRate: z.number().min(0).max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await authorizeArca(req, "items:write");
    const existing = await prisma.item.findFirst({ where: { id, orgId: ctx.org.id } });
    if (!existing) return error(404, "Item no encontrado", "not_found");

    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(422, "Datos inválidos", "unprocessable");

    const item = await prisma.item.update({
      where: { id },
      data: {
        ...parsed.data,
        metadata: parsed.data.metadata as object | undefined,
      },
    });
    return ok({ item: { id: item.id, description: item.description } });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await authorizeArca(req, "items:write");
    const existing = await prisma.item.findFirst({ where: { id, orgId: ctx.org.id } });
    if (!existing) return error(404, "Item no encontrado", "not_found");
    await prisma.item.delete({ where: { id } });
    return ok({ status: "deleted" });
  } catch (err) {
    return handleError(err);
  }
}
