import { z } from "zod";
import { loginUser } from "@/application/auth/auth-service";
import { issueSession, issuePendingAccessToken } from "@/application/auth/session-service";
import { trackLogin, type AcquisitionPayload } from "@/application/auth/login-tracking";
import { setRefreshCookie } from "@/interface/http/cookies";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, error, handleError } from "@/interface/http/responses";
import { publicUser } from "@/interface/http/serializers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const acquisitionSchema = z
  .object({
    referrer: z.string().max(512).optional(),
    landingPath: z.string().max(256).optional(),
    utmSource: z.string().max(128).optional(),
    utmMedium: z.string().max(128).optional(),
    utmCampaign: z.string().max(128).optional(),
  })
  .optional();

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  acquisition: acquisitionSchema,
});

async function primaryOrgId(userId: string): Promise<string | null> {
  const m = await prisma.membership.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { orgId: true },
  });
  return m?.orgId ?? null;
}

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(422, "Datos inválidos", "unprocessable");

    const result = await loginUser(parsed.data.email, parsed.data.password);

    if (result.twoFactorRequired) {
      const pendingToken = await issuePendingAccessToken(result.user);
      await audit({
        actorId: result.user.id,
        action: "auth.login.2fa_challenge",
        ip: clientIp(req),
      });
      return ok({
        status: "twofa_required",
        method: result.twoFactorMethod,
        pendingToken,
      });
    }

    const session = await issueSession(result.user);
    const orgId = await primaryOrgId(result.user.id);
    await trackLogin({
      req,
      userId: result.user.id,
      orgId,
      acquisition: parsed.data.acquisition as AcquisitionPayload | undefined,
    });
    await audit({ actorId: result.user.id, action: "auth.login", ip: clientIp(req) });

    const res = ok({
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      user: publicUser(result.user),
    });
    setRefreshCookie(res, session.refreshToken);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
