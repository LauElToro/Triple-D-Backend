-- AlterEnum
CREATE TYPE "PlanStatus" AS ENUM ('active', 'pending_payment');
CREATE TYPE "PaymentProvider" AS ENUM ('manual', 'mercadopago');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "pendingPlanId" "PlanId",
ADD COLUMN "planStatus" "PlanStatus" NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'manual',
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "amount" DECIMAL(12,2) NOT NULL,
    "externalId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_orgId_idx" ON "Payment"("orgId");
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
