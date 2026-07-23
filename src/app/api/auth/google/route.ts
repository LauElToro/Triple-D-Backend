import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { issueSession, issuePendingAccessToken } from "@/application/auth/session-service";
import { setRefreshCookie } from "@/interface/http/cookies";
import { audit, clientIp } from "@/interface/http/audit";
import { ok, error, handleError } from "@/interface/http/responses";
import { publicUser } from "@/interface/http/serializers";

export const runtime = "nodejs";

const schema = z.object({ credential: z.string().min(10) });

interface GoogleTokenInfo {
  aud: string;
  sub: string;
  email: string;
  email_verified: string | boolean;
  name?: string;
}

/**
 * Native + Google login. The frontend obtains a Google ID token (credential)
 * via Google Identity Services and posts it here for server-side verification.
 */
export async function POST(req: Request) {
  try {
    if (!env.googleClientId) {
      return error(501, "Google OAuth no está configurado", "google_not_configured");
    }
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(422, "Datos inválidos", "unprocessable");

    const info = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(parsed.data.credential)}`
    );
    if (!info.ok) return error(401, "Token de Google inválido", "invalid_google_token");
    const payload = (await info.json()) as GoogleTokenInfo;

    if (payload.aud !== env.googleClientId) {
      return error(401, "Token de Google no coincide con la app", "aud_mismatch");
    }

    const email = payload.email.toLowerCase().trim();
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: payload.sub }, { email }] },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          googleId: payload.sub,
          name: payload.name,
          emailVerified: true,
          systemRole: "USER",
          ownedOrganizations: { create: { name: payload.name ?? email.split("@")[0] } },
        },
        include: { ownedOrganizations: true },
      });
      const created = await prisma.organization.findFirst({ where: { ownerId: user.id } });
      if (created) {
        await prisma.membership.create({
          data: { userId: user.id, orgId: created.id, orgRole: "OWNER" },
        });
      }
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub, emailVerified: true },
      });
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const pendingToken = await issuePendingAccessToken(user);
      return ok({ status: "twofa_required", method: "totp", pendingToken });
    }

    const session = await issueSession(user);
    await audit({ actorId: user.id, action: "auth.login.google", ip: clientIp(req) });

    const res = ok({
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      user: publicUser(user),
    });
    setRefreshCookie(res, session.refreshToken);
    return res;
  } catch (err) {
    return handleError(err);
  }
}
