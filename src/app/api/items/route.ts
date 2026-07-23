import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeArca } from "@/interface/http/arcaAuth";
import { ok, created, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

const createSchema = z.object({
  description: z.string().min(1),
  sku: z.string().optional(),
  unitPrice: z.number().nonnegative().default(0),
  ivaRate: z.number().min(0).max(100).default(21),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET(req: Request) {
  try {
    const ctx = await authorizeArca(req, "items:read");
    const items = await prisma.item.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
    });
    return ok({
      items: items.map((i) => ({
        id: i.id,
        sku: i.sku,
        description: i.description,
        unitPrice: Number(i.unitPrice),
        ivaRate: Number(i.ivaRate),
        metadata: i.metadata,
        createdAt: i.createdAt,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await authorizeArca(req, "items:write");
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(422, "Datos inválidos", "unprocessable", parsed.error.flatten());

    const item = await prisma.item.create({
      data: {
        orgId: ctx.org.id,
        description: parsed.data.description,
        sku: parsed.data.sku,
        unitPrice: parsed.data.unitPrice,
        ivaRate: parsed.data.ivaRate,
        metadata: parsed.data.metadata as object | undefined,
      },
    });
    return created({ item: { id: item.id, description: item.description } });
  } catch (err) {
    return handleError(err);
  }
}
