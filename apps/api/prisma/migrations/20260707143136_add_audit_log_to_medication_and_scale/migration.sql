/*
  Warnings:

  - Made the column `total` on table `clinical_scales` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "clinical_scales" ADD COLUMN     "auditLog" JSONB,
ALTER COLUMN "total" SET NOT NULL;

-- AlterTable
ALTER TABLE "medication_prescriptions" ADD COLUMN     "auditLog" JSONB;
