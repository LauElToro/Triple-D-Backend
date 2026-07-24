import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SUPERADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.SUPERADMIN_PASSWORD || "";

  if (!email || !password) {
    console.warn("[seed] SUPERADMIN_EMAIL/PASSWORD not set, skipping superadmin seed.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { systemRole: "SUPERADMIN", emailVerified: true, kycStatus: "APPROVED" },
    create: {
      email,
      passwordHash,
      name: "Super Admin",
      systemRole: "SUPERADMIN",
      emailVerified: true,
      kycStatus: "APPROVED",
    },
  });

  // Ensure the superadmin owns an internal organization.
  const org = await prisma.organization.findFirst({ where: { ownerId: user.id } });
  if (!org) {
    const created = await prisma.organization.create({
      data: { name: "Set-Api (interno)", ownerId: user.id, planId: "usage", kycStatus: "APPROVED" },
    });
    await prisma.membership.create({
      data: { userId: user.id, orgId: created.id, orgRole: "OWNER" },
    });
  }

  console.log(`[seed] SUPERADMIN ready: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
