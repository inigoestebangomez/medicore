-- Migration 20260709155340: Add billing, AI usage, Stripe events
-- Made idempotent — partial apply occurred before Prisma tracking was in place.

-- CreateEnum (may already exist from partial apply)
DO $$ BEGIN
    CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: add nullable billingInterval column (FREE orgs stay null)
DO $$ BEGIN
    ALTER TABLE "organizations" ADD COLUMN "billingInterval" "BillingInterval";
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- CreateTable: AiReportUsage
CREATE TABLE IF NOT EXISTS "ai_report_usage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_report_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "ai_report_usage_organizationId_yearMonth_key" ON "ai_report_usage"("organizationId", "yearMonth");
CREATE INDEX IF NOT EXISTS "ai_report_usage_organizationId_idx" ON "ai_report_usage"("organizationId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ai_report_usage" ADD CONSTRAINT "ai_report_usage_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: ProcessedStripeEvent
CREATE TABLE IF NOT EXISTS "processed_stripe_events" (
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_stripe_events_pkey" PRIMARY KEY ("eventId")
);
