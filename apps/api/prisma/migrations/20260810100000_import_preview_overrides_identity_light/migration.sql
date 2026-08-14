-- Import preview edits, explicit discard audit, and opt-in NHC-only patients.
ALTER TABLE "patients"
  ALTER COLUMN "firstName" DROP NOT NULL,
  ALTER COLUMN "lastName" DROP NOT NULL;

ALTER TABLE "import_batches"
  ADD COLUMN "ignoredColumns" JSONB,
  ADD COLUMN "previewOverrides" JSONB,
  ADD COLUMN "cellOverrides" JSONB;
