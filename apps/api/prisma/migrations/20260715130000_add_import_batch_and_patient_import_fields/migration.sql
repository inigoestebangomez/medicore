-- Phase 11 — Import Module
-- Adds ImportBatch model, Patient.importedData JSONB + GIN index, pg_trgm
-- extension and trigram index on patient names for fuzzy matching (AD-4).

-- Enable trigram extension for fuzzy name matching (BR-IMP patient matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- New enum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'CONFIRMING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- ImportBatch table
CREATE TABLE "import_batches" (
  "id"              TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "createdBy"       TEXT NOT NULL,
  "fileName"        TEXT NOT NULL,
  "fileSize"        INTEGER NOT NULL,
  "fileHash"        TEXT NOT NULL,
  "originalFormat"  TEXT NOT NULL,
  "sample"          JSONB NOT NULL,
  "columnMapping"   JSONB NOT NULL,
  "customFieldNames" JSONB NOT NULL DEFAULT '{}',
  "junkRowIndices"  INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "aiConfidence"    DOUBLE PRECISION,
  "aiProvider"      TEXT,
  "issues"          TEXT[] DEFAULT ARRAY[]::TEXT[],
  "notes"           TEXT,
  "totalRows"       INTEGER NOT NULL DEFAULT 0,
  "importedRows"    INTEGER NOT NULL DEFAULT 0,
  "enrichedRows"   INTEGER NOT NULL DEFAULT 0,
  "createdRows"     INTEGER NOT NULL DEFAULT 0,
  "skippedRows"     INTEGER NOT NULL DEFAULT 0,
  "pendingRows"     INTEGER NOT NULL DEFAULT 0,
  "snapshot"        JSONB,
  "status"          "ImportStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage"    TEXT,
  "createdAt"       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"     TIMESTAMPTZ(3),
  "deletedAt"       TIMESTAMPTZ(3),

  CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "import_batches"
  ADD CONSTRAINT "import_batches_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "import_batches"
  ADD CONSTRAINT "import_batches_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "import_batches_organizationId_idx" ON "import_batches"("organizationId");
CREATE INDEX "import_batches_organizationId_createdAt_idx" ON "import_batches"("organizationId", "createdAt");
CREATE INDEX "import_batches_organizationId_status_idx" ON "import_batches"("organizationId", "status");

-- Patient extensions
ALTER TABLE "patients"
  ADD COLUMN "importedData"  JSONB,
  ADD COLUMN "importSource"  TEXT,
  ADD COLUMN "importBatchId" TEXT;

ALTER TABLE "patients"
  ADD CONSTRAINT "patients_importBatchId_fkey"
  FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "patients_organizationId_importBatchId_idx"
  ON "patients"("organizationId", "importBatchId");

-- GIN index on importedData for JSONB path queries (spec §6, AD-3)
CREATE INDEX "idx_patients_imported_data"
  ON "patients" USING GIN ("importedData");

-- Trigram index for fuzzy patient name matching (AD-4)
-- Wraps concatenation in a function-supporting expression; pg_trgm operator class.
CREATE INDEX "idx_patients_name_trgm"
  ON "patients" USING GIN (("lastName" || ' ' || "firstName") gin_trgm_ops);