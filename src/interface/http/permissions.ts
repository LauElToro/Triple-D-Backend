import type { OrgRole, SubRole } from "@prisma/client";

export type Permission =
  | "org:manage"
  | "team:read"
  | "team:write"
  | "keys:read"
  | "keys:write"
  | "usage:read"
  | "billing:read"
  | "invoices:read"
  | "arca:read"
  | "arca:write"
  | "items:read"
  | "items:write"
  | "tickets:read"
  | "tickets:write";

const ALL: Permission[] = [
  "org:manage",
  "team:read",
  "team:write",
  "keys:read",
  "keys:write",
  "usage:read",
  "billing:read",
  "invoices:read",
  "arca:read",
  "arca:write",
  "items:read",
  "items:write",
  "tickets:read",
  "tickets:write",
];

/** Sub-role permission matrix for invited USERS. */
const SUB_ROLE_PERMISSIONS: Record<SubRole, Permission[]> = {
  // Developers: integrate the SDK — keys, ARCA and items, read usage.
  DEV: ["keys:read", "keys:write", "usage:read", "arca:read", "arca:write", "items:read", "items:write", "tickets:read", "tickets:write"],
  // Accounting: invoices, billing, ARCA comprobantes and items (read).
  CONTABILIDAD: ["usage:read", "billing:read", "invoices:read", "arca:read", "arca:write", "items:read", "tickets:read", "tickets:write"],
  // Administration: team, billing overview and tickets.
  ADMINISTRACION: ["team:read", "team:write", "usage:read", "billing:read", "invoices:read", "tickets:read", "tickets:write"],
};

/**
 * Resolve the effective permissions of a membership.
 * OWNER/ADMIN of an organization get everything; MEMBERs are scoped by subRole.
 */
export function permissionsFor(orgRole: OrgRole, subRole: SubRole | null): Permission[] {
  if (orgRole === "OWNER" || orgRole === "ADMIN") return ALL;
  if (subRole) return SUB_ROLE_PERMISSIONS[subRole] ?? [];
  return [];
}

export function hasPermission(
  orgRole: OrgRole,
  subRole: SubRole | null,
  permission: Permission
): boolean {
  return permissionsFor(orgRole, subRole).includes(permission);
}
