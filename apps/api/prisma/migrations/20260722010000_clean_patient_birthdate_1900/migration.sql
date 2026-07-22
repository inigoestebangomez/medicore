-- SDD import-data-quality T-08: data cleanup migration.
-- Historically an unknown birth date was persisted as the synthetic placeholder
-- 1900-01-01. The schema is now nullable (see 20260722000000_patient_birthdate_nullable),
-- so replace every remaining placeholder with a real NULL.
--
-- Idempotent: safe to re-run (matches the placeholder by value).
UPDATE "Patient" SET "birthDate" = NULL
WHERE "birthDate" = '1900-01-01T00:00:00.000Z'::timestamp;