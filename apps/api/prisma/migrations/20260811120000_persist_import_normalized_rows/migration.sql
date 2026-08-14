-- Import workflow: persist normalized rows so preview and confirmation can
-- resume after an API restart without storing the uploaded binary buffer.
-- RGPD: this JSONB contains the minimum normalized row representation needed
-- for the import workflow and should follow the ImportBatch retention policy.
ALTER TABLE "import_batches"
  ADD COLUMN "normalizedRows" JSONB,
  ADD COLUMN "ignoredRows" JSONB;
