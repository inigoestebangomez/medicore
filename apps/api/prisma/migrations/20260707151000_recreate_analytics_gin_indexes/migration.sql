-- Fix: Recreate GIN indexes dropped by auto-generated migration 20260707144639
-- These are required for Phase 8 analytics JSONB queries

CREATE INDEX IF NOT EXISTS idx_consultations_diagnosis_codes
  ON "consultations" USING GIN ("diagnosisCodes");

CREATE INDEX IF NOT EXISTS idx_surgeries_procedure_codes
  ON "surgeries" USING GIN ("procedureCodes");
