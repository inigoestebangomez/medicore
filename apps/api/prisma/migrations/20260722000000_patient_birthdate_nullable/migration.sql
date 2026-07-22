-- T-01: Make Patient.birthDate nullable.
-- Imported records may lack a birth date; previously the import pipeline
-- fell back to 1900-01-01, producing misleading demographic data. Making
-- the column nullable lets the import path store NULL instead. Data
-- cleanup of existing 1900-01-01 placeholders is a separate, idempotent
-- migration (PR 3, T-08).

-- AlterTable
ALTER TABLE "patients" ALTER COLUMN "birthDate" DROP NOT NULL;