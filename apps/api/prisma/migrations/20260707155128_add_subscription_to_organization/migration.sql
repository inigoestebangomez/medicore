-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- DropIndex
DROP INDEX "idx_consultations_diagnosis_codes";

-- DropIndex
DROP INDEX "idx_surgeries_procedure_codes";

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "subscriptionExpiresAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE';

-- Backfill existing organizations (no-op since DEFAULT handles it)
UPDATE "organizations" SET "subscriptionStatus" = 'ACTIVE' WHERE "subscriptionStatus" IS NULL;
