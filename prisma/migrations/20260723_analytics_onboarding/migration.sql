-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingSkippedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tourCompleted" JSONB;

-- AlterTable Organization
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "heardAbout" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "intendedUse" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "companyRole" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "companySize" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);

-- AlterTable UsageRecord
ALTER TABLE "UsageRecord" ADD COLUMN IF NOT EXISTS "service" TEXT;
ALTER TABLE "UsageRecord" ADD COLUMN IF NOT EXISTS "providerCost" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable LoginEvent
CREATE TABLE IF NOT EXISTS "LoginEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "country" TEXT,
    "referrer" TEXT,
    "landingPath" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoginEvent_userId_createdAt_idx" ON "LoginEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "LoginEvent_createdAt_idx" ON "LoginEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "LoginEvent_country_idx" ON "LoginEvent"("country");
CREATE INDEX IF NOT EXISTS "UsageRecord_service_createdAt_idx" ON "UsageRecord"("service", "createdAt");

DO $$ BEGIN
  ALTER TABLE "LoginEvent" ADD CONSTRAINT "LoginEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LoginEvent" ADD CONSTRAINT "LoginEvent_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
