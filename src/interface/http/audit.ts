import { prisma } from "@/lib/prisma";

export async function audit(params: {
  actorId?: string | null;
  action: string;
  target?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        target: params.target,
        metadata: params.metadata as object | undefined,
        ip: params.ip ?? undefined,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write log:", err);
  }
}

export function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}
