-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- AlterTable: add nullable billingInterval column (FREE orgs stay null)
ALTER TABLE "organizations" ADD COLUMN "billingInterval" "BillingInterval";

-- CreateTable: AiReportUsage — per-organization monthly AI report counter
CREATE TABLE "ai_report_usage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_report_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_report_usage_organizationId_yearMonth_key" ON "ai_report_usage"("organizationId", "yearMonth");
CREATE INDEX "ai_report_usage_organizationId_idx" ON "ai_report_usage"("organizationId");

-- AddForeignKey
ALTER TABLE "ai_report_usage" ADD CONSTRAINT "ai_report_usage_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ProcessedStripeEvent — webhook idempotency (eventId is PK)
CREATE TABLE "processed_stripe_events" (
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_stripe_events_pkey" PRIMARY KEY ("eventId")
);