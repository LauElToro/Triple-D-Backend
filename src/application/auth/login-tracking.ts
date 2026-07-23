import { prisma } from "@/lib/prisma";
import { clientIp } from "@/interface/http/audit";

export interface AcquisitionPayload {
  referrer?: string;
  landingPath?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export function clientCountry(req: Request): string | null {
  return (
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("x-country-code") ||
    null
  );
}

/**
 * Persist lastLoginAt + a LoginEvent for analytics (best-effort).
 */
export async function trackLogin(params: {
  req: Request;
  userId: string;
  orgId?: string | null;
  acquisition?: AcquisitionPayload | null;
}): Promise<void> {
  const { req, userId, orgId, acquisition } = params;
  const now = new Date();

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: now },
      }),
      prisma.loginEvent.create({
        data: {
          userId,
          orgId: orgId ?? null,
          ip: clientIp(req),
          userAgent: req.headers.get("user-agent")?.slice(0, 512) ?? null,
          country: clientCountry(req)?.slice(0, 8) ?? null,
          referrer: acquisition?.referrer?.slice(0, 512) ?? null,
          landingPath: acquisition?.landingPath?.slice(0, 256) ?? null,
          utmSource: acquisition?.utmSource?.slice(0, 128) ?? null,
          utmMedium: acquisition?.utmMedium?.slice(0, 128) ?? null,
          utmCampaign: acquisition?.utmCampaign?.slice(0, 128) ?? null,
        },
      }),
    ]);
  } catch (err) {
    console.error("[login-tracking] failed:", err);
  }
}

export const acquisitionSchemaShape = {
  referrer: true,
  landingPath: true,
  utmSource: true,
  utmMedium: true,
  utmCampaign: true,
} as const;
