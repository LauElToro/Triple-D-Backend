import { prisma } from "@/lib/prisma";
import { requireUser, resolveOrgContext, requirePermission } from "@/interface/http/session";
import { generateApiKey } from "@/infrastructure/security/apiKey";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, error, handleError } from "@/interface/http/responses";
import { publicApiKey } from "@/interface/http/serializers";

export const runtime = "nodejs";

/** Rotate a key: revoke the old one and issue a replacement (plaintext once). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser(req);
    const ctx = await resolveOrgContext(req, user);
    requirePermission(ctx, "keys:write");

    const old = await prisma.apiKey.findFirst({ where: { id, orgId: ctx.org.id } });
    if (!old) return error(404, "API Key no encontrada", "not_found");

    const generated = generateApiKey();
    const now = new Date();

    const [, key] = await prisma.$transaction([
      prisma.apiKey.update({
        where: { id },
        data: { status: "revoked", revokedAt: now },
      }),
      prisma.apiKey.create({
        data: {
          orgId: ctx.org.id,
          name: old.name,
          prefix: generated.prefix,
          keyHash: generated.keyHash,
          usageStartedAt: now,
          cycleEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    await audit({ actorId: user.id, action: "keys.rotated", target: key.id, ip: clientIp(req) });
    return ok({ key: publicApiKey(key), plaintext: generated.plaintext });
  } catch (err) {
    return handleError(err);
  }
}
