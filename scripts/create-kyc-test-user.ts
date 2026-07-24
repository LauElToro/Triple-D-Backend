import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "test@test.com";
  const passwordHash = await bcrypt.hash("admin123!", 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      emailVerified: true,
      kycStatus: "NOT_STARTED",
      systemRole: "USER",
      onboardingSkippedAt: new Date(),
      name: "Usuario Test KYC",
    },
    create: {
      email,
      passwordHash,
      name: "Usuario Test KYC",
      systemRole: "USER",
      emailVerified: true,
      kycStatus: "NOT_STARTED",
      onboardingSkippedAt: new Date(),
    },
  });

  let org = await prisma.organization.findFirst({ where: { ownerId: user.id } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Org Test KYC",
        ownerId: user.id,
        planId: "free",
        kycStatus: "NOT_STARTED",
      },
    });
    await prisma.membership.create({
      data: { userId: user.id, orgId: org.id, orgRole: "OWNER" },
    });
  } else {
    const m = await prisma.membership.findFirst({
      where: { userId: user.id, orgId: org.id },
    });
    if (!m) {
      await prisma.membership.create({
        data: { userId: user.id, orgId: org.id, orgRole: "OWNER" },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        userId: user.id,
        email: user.email,
        orgId: org.id,
        kycStatus: user.kycStatus,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
