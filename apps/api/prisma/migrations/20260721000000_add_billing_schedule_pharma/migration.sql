-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('CONSULTATION', 'SURGERY', 'TREATMENT', 'SUBSCRIPTION', 'OTHER');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('CALL', 'MEETING', 'EMAIL', 'LUNCH', 'CONFERENCE', 'OTHER');

-- CreateTable
CREATE TABLE "billing_transactions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT,
    "consultationId" TEXT,
    "surgeryId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "BillingType" NOT NULL DEFAULT 'OTHER',
    "status" "BillingStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "billing_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_schedules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotDuration" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharma_contacts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pharma_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharma_interactions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "InteractionType" NOT NULL DEFAULT 'OTHER',
    "notes" TEXT,
    "followUpNeeded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pharma_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_transactions_organizationId_date_idx" ON "billing_transactions"("organizationId", "date");

-- CreateIndex
CREATE INDEX "billing_transactions_organizationId_status_idx" ON "billing_transactions"("organizationId", "status");

-- CreateIndex
CREATE INDEX "doctor_schedules_organizationId_userId_idx" ON "doctor_schedules"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_schedules_organizationId_userId_dayOfWeek_key" ON "doctor_schedules"("organizationId", "userId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "pharma_contacts_organizationId_idx" ON "pharma_contacts"("organizationId");

-- CreateIndex
CREATE INDEX "pharma_contacts_organizationId_company_idx" ON "pharma_contacts"("organizationId", "company");

-- CreateIndex
CREATE INDEX "pharma_interactions_contactId_date_idx" ON "pharma_interactions"("contactId", "date");

-- CreateIndex
CREATE INDEX "pharma_interactions_organizationId_date_idx" ON "pharma_interactions"("organizationId", "date");

-- AddForeignKey
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "surgeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharma_contacts" ADD CONSTRAINT "pharma_contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharma_interactions" ADD CONSTRAINT "pharma_interactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharma_interactions" ADD CONSTRAINT "pharma_interactions_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "pharma_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;