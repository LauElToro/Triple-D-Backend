import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/interface/http/session";
import { ok, handleError } from "@/interface/http/responses";
import { publicUser } from "@/interface/http/serializers";

export const runtime = "nodejs";

const schema = z.object({
  route: z.string().min(1).max(120),
  completed: z.boolean().default(true),
});

/** Mark a product tour as completed for the current user. */
export async function PATCH(req: Request) {
  try {
    const user = await requireUser(req);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return ok({ user: publicUser(user) });
    }

    const current = (user.tourCompleted as Record<string, string> | null) ?? {};
    const next = { ...current };
    if (parsed.data.completed) {
      next[parsed.data.route] = new Date().toISOString();
    } else {
      delete next[parsed.data.route];
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { tourCompleted: next },
    });

    return ok({ user: publicUser(updated), tourCompleted: next });
  } catch (err) {
    return handleError(err);
  }
}
