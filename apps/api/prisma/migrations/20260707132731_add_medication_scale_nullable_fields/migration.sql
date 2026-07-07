/*
  Warnings:

  - Added the required column `updatedAt` to the `clinical_scales` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "clinical_scales" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "total" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "medication_prescriptions" ADD COLUMN     "discontinuationReason" TEXT,
ADD COLUMN     "updatedBy" TEXT;
