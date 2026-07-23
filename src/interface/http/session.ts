import { cookies } from "next/headers";
import type { Organization, Membership, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken, type AccessTokenClaims } from "@/infrastructure/security/jwt";
import { HttpError } from "./responses";
import { hasPermission, permissionsFor, type Permission } from "./permissions";

function getBearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

export async function getSessionClaims(req: Request): Promise<AccessTokenClaims | null> {
  const token = getBearer(req);
  if (!token) return null;
  return verifyAccessToken(token);
}

/**
 * Load the authenticated user fresh from the DB (so a revoked/changed role or
 * KYC status is always current and cannot be spoofed from the token payload).
 */
export async function requireUser(req: Request): Promise<User> {
  const claims = await getSessionClaims(req);
  if (!claims?.sub) throw new HttpError(401, "No autenticado", "unauthorized");
  if (claims.twoFactorPending) {
    throw new HttpError(401, "Verificación en dos pasos pendiente", "twofa_required");
  }
  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user) throw new HttpError(401, "No autenticado", "unauthorized");
  return user;
}

export function requireSystemRole(user: User, roles: User["systemRole"][]): void {
  if (!roles.includes(user.systemRole)) {
    throw new HttpError(403, "Permiso insuficiente", "forbidden");
  }
}

export function requireKycApproved(user: User): void {
  if (user.systemRole === "SUPERADMIN") return;
  if (user.kycStatus !== "APPROVED") {
    throw new HttpError(403, "Debés completar la verificación KYC", "kyc_required");
  }
}

export interface OrgContext {
  org: Organization;
  membership: Membership | null; // null for SUPERADMIN acting cross-org
  permissions: Permission[];
  isSuperAdmin: boolean;
}

function requestedOrgId(req: Request): string | null {
  const header = req.headers.get("x-org-id");
  if (header) return header;
  const url = new URL(req.url);
  return url.searchParams.get("orgId");
}

/**
 * Resolve the organization the request operates on and the caller's effective
 * permissions inside it. Authorization is always re-checked against the DB.
 */
export async function resolveOrgContext(req: Request, user: User): Promise<OrgContext> {
  const orgId = requestedOrgId(req);

  if (user.systemRole === "SUPERADMIN") {
    const org = orgId
      ? await prisma.organization.findUnique({ where: { id: orgId } })
      : await prisma.organization.findFirst({ where: { ownerId: user.id } });
    if (!org) throw new HttpError(404, "Organización no encontrada", "not_found");
    return {
      org,
      membership: null,
      permissions: permissionsFor("OWNER", null),
      isSuperAdmin: true,
    };
  }

  const membership = orgId
    ? await prisma.membership.findFirst({
        where: { userId: user.id, orgId, status: "ACTIVE" },
        include: { org: true },
      })
    : await prisma.membership.findFirst({
        where: { userId: user.id, status: "ACTIVE" },
        include: { org: true },
        orderBy: { createdAt: "asc" },
      });

  if (!membership) throw new HttpError(403, "Sin acceso a la organización", "forbidden");

  return {
    org: membership.org,
    membership,
    permissions: permissionsFor(membership.orgRole, membership.subRole),
    isSuperAdmin: false,
  };
}

export function requirePermission(ctx: OrgContext, permission: Permission): void {
  if (ctx.isSuperAdmin) return;
  if (!ctx.membership) throw new HttpError(403, "Permiso insuficiente", "forbidden");
  if (!hasPermission(ctx.membership.orgRole, ctx.membership.subRole, permission)) {
    throw new HttpError(403, "Permiso insuficiente", "forbidden");
  }
}
