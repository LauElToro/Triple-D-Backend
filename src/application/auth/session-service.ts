import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { signAccessToken } from "@/infrastructure/security/jwt";
import { randomToken, sha256 } from "@/infrastructure/security/tokens";

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Short-lived access token proving password step; no refresh token issued. */
export async function issuePendingAccessToken(user: User): Promise<string> {
  return signAccessToken({
    sub: user.id,
    systemRole: user.systemRole,
    email: user.email,
    twoFactorPending: true,
  });
}

export async function issueSession(
  user: User,
  opts: { twoFactorPending?: boolean } = {}
): Promise<IssuedSession> {
  const accessToken = await signAccessToken({
    sub: user.id,
    systemRole: user.systemRole,
    email: user.email,
    twoFactorPending: opts.twoFactorPending,
  });

  const refreshToken = randomToken(48);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + env.refreshTokenTtlSeconds * 1000),
    },
  });

  return { accessToken, refreshToken, expiresIn: env.accessTokenTtlSeconds };
}

/**
 * Rotate a refresh token: validate it, revoke it, and issue a fresh pair.
 * Returns null when the token is invalid/expired/revoked.
 */
export async function rotateSession(refreshToken: string): Promise<{
  user: User;
  session: IssuedSession;
} | null> {
  const tokenHash = sha256(refreshToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existing || existing.revoked || existing.expiresAt < new Date()) {
    return null;
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revoked: true },
  });

  const session = await issueSession(existing.user);
  return { user: existing.user, session };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const tokenHash = sha256(refreshToken);
  await prisma.refreshToken
    .update({ where: { tokenHash }, data: { revoked: true } })
    .catch(() => undefined);
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true },
  });
}
