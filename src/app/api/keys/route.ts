import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, resolveOrgContext, requirePermission, requireKycApproved } from "@/interface/http/session";
import { generateApiKey } from "@/infrastructure/security/apiKey";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, created, handleError } from "@/interface/http/responses";
import { publicApiKey } from "@/interface/http/serializers";

export const runtime = "nodejs";

const createSchema = z.object({ name: z.string().min(1).max(60).optional() });

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const ctx = await resolveOrgContext(req, user);
    requirePermission(ctx, "keys:read");

    const keys = await prisma.apiKey.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
    });
    return ok({ keys: keys.map(publicApiKey) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    requireKycApproved(user);
    const ctx = await resolveOrgContext(req, user);
    requirePermission(ctx, "keys:write");

    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    const name = parsed.success ? parsed.data.name ?? "default" : "default";

    const generated = generateApiKey();
    const now = new Date();
    const cycleEnds = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const key = await prisma.apiKey.create({
      data: {
        orgId: ctx.org.id,
        name,
        prefix: generated.prefix,
        keyHash: generated.keyHash,
        usageStartedAt: now,
        cycleEndsAt: cycleEnds,
      },
    });

    await audit({ actorId: user.id, action: "keys.created", target: key.id, ip: clientIp(req) });

    // Plaintext is returned only once, at creation time.
    return created({ key: publicApiKey(key), plaintext: generated.plaintext });
  } catch (err) {
    return handleError(err);
  }
}
