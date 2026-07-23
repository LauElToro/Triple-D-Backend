import type { OtpPurpose } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { numericOtp, sha256 } from "@/infrastructure/security/tokens";

const TTL: Record<OtpPurpose, number> = {
  EMAIL_VERIFY: 15 * 60 * 1000,
  LOGIN_2FA: 5 * 60 * 1000,
  PASSWORD_RESET: 15 * 60 * 1000,
};

export async function issueOtp(userId: string, purpose: OtpPurpose): Promise<string> {
  const code = numericOtp(6);
  // Invalidate previous unconsumed codes for the same purpose.
  await prisma.otpCode.updateMany({
    where: { userId, purpose, consumed: false },
    data: { consumed: true },
  });
  await prisma.otpCode.create({
    data: {
      userId,
      purpose,
      codeHash: sha256(code),
      expiresAt: new Date(Date.now() + TTL[purpose]),
    },
  });
  return code;
}

export async function verifyOtp(
  userId: string,
  purpose: OtpPurpose,
  code: string
): Promise<boolean> {
  const record = await prisma.otpCode.findFirst({
    where: {
      userId,
      purpose,
      consumed: false,
      expiresAt: { gt: new Date() },
      codeHash: sha256(code),
    },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return false;
  await prisma.otpCode.update({ where: { id: record.id }, data: { consumed: true } });
  return true;
}
