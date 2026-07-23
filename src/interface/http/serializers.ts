import type { ApiKey, Invoice, Organization, User, Membership } from "@prisma/client";
import { permissionsFor } from "./permissions";

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    systemRole: user.systemRole,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    kycStatus: user.kycStatus,
    lastLoginAt: user.lastLoginAt,
    onboardingSkippedAt: user.onboardingSkippedAt,
    tourCompleted: (user.tourCompleted as Record<string, string> | null) ?? null,
    createdAt: user.createdAt,
  };
}

export function publicOrg(org: Organization, membership?: Membership | null) {
  return {
    id: org.id,
    name: org.name,
    planId: org.planId,
    kycStatus: org.kycStatus,
    arcaCuit: org.arcaCuit,
    clientType: org.clientType,
    source: org.source,
    heardAbout: org.heardAbout,
    intendedUse: org.intendedUse,
    companyRole: org.companyRole,
    companySize: org.companySize,
    onboardingCompletedAt: org.onboardingCompletedAt,
    orgRole: membership?.orgRole ?? "OWNER",
    subRole: membership?.subRole ?? null,
    permissions: membership
      ? permissionsFor(membership.orgRole, membership.subRole)
      : permissionsFor("OWNER", null),
  };
}

export function publicApiKey(key: ApiKey) {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    status: key.status,
    lastUsedAt: key.lastUsedAt,
    usageStartedAt: key.usageStartedAt,
    cycleEndsAt: key.cycleEndsAt,
    createdAt: key.createdAt,
  };
}

export function publicInvoice(inv: Invoice) {
  return {
    id: inv.id,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    amount: Number(inv.amount),
    units: inv.units,
    status: inv.status,
    dueAt: inv.dueAt,
    issuedAt: inv.issuedAt,
    paidAt: inv.paidAt,
  };
}
