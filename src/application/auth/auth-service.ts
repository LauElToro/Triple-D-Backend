import type { PlanId, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/infrastructure/security/password";
import { sendMail } from "@/infrastructure/email/mailer";
import {
  welcomeTemplate,
  verifyEmailTemplate,
  twoFactorTemplate,
  loginAlertTemplate,
} from "@/infrastructure/email/templates";
import { HttpError } from "@/interface/http/responses";
import { issueOtp } from "./otp-service";

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
  plan?: PlanId;
  orgName?: string;
}

export async function registerUser(input: RegisterInput): Promise<User> {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, "El email ya está registrado", "email_taken");

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: input.name,
      systemRole: "USER",
      ownedOrganizations: {
        create: {
          name: input.orgName ?? input.name ?? email.split("@")[0],
          planId: input.plan ?? "free",
        },
      },
    },
    include: { ownedOrganizations: true },
  });

  // The owner is also a member (OWNER) of their organization.
  const org = user.ownedOrganizations[0];
  await prisma.membership.create({
    data: { userId: user.id, orgId: org.id, orgRole: "OWNER" },
  });

  const code = await issueOtp(user.id, "EMAIL_VERIFY");
  await sendMail({ to: email, ...welcomeTemplate(email) });
  await sendMail({ to: email, ...verifyEmailTemplate(code) });

  return user;
}

export interface LoginResult {
  user: User;
  twoFactorRequired: boolean;
  twoFactorMethod?: "totp" | "email";
}

export async function loginUser(email: string, password: string): Promise<LoginResult> {
  const normalized = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user || !user.passwordHash) {
    throw new HttpError(401, "Credenciales inválidas", "invalid_credentials");
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new HttpError(401, "Credenciales inválidas", "invalid_credentials");

  if (user.twoFactorEnabled) {
    if (user.twoFactorSecret) {
      return { user, twoFactorRequired: true, twoFactorMethod: "totp" };
    }
    // Email OTP fallback
    const code = await issueOtp(user.id, "LOGIN_2FA");
    await sendMail({ to: user.email, ...twoFactorTemplate(code) });
    return { user, twoFactorRequired: true, twoFactorMethod: "email" };
  }

  await sendMail({
    to: user.email,
    ...loginAlertTemplate(user.email, new Date().toLocaleString("es-AR")),
  });
  return { user, twoFactorRequired: false };
}
