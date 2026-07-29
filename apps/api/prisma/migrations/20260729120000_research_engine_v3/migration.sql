-- Research Engine V3 — additive schema (M8 + M1 foundation)
-- New models: research_studies, study_notifications. No ALTER on existing tables.
-- Back-relations: research_queries already supports collections; studies[] is read-only client-side.

-- StudyStatus enum
DO $$ BEGIN
    CREATE TYPE "StudyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'FROZEN');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ResearchStudy
CREATE TABLE "research_studies" (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by"      TEXT NOT NULL,
    "query_id"        TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "status"          "StudyStatus" NOT NULL DEFAULT 'DRAFT',
    "cached_patient_ids" JSONB NOT NULL DEFAULT '[]',
    "cached_at"       TIMESTAMP(3),
    "patient_count"   INTEGER NOT NULL DEFAULT 0,
    "analyses"        JSONB NOT NULL DEFAULT '[]',
    "publication_ref" TEXT,
    "frozen_at"       TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,
    "deleted_at"      TIMESTAMP(3),

    CONSTRAINT "research_studies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "research_studies_organization_id_status_idx" ON "research_studies"("organization_id", "status");
CREATE INDEX "research_studies_organization_id_created_by_idx" ON "research_studies"("organization_id", "created_by");
CREATE INDEX "research_studies_query_id_idx" ON "research_studies"("query_id");

ALTER TABLE "research_studies"
    ADD CONSTRAINT "research_studies_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "research_studies"
    ADD CONSTRAINT "research_studies_query_id_fkey"
    FOREIGN KEY ("query_id") REFERENCES "research_queries"("id") ON DELETE RESTRICT;

-- StudyNotification
CREATE TABLE "study_notifications" (
    "id"                 TEXT NOT NULL,
    "study_id"           TEXT NOT NULL,
    "organization_id"    TEXT NOT NULL,
    "user_id"            TEXT NOT NULL,
    "new_patient_count"  INTEGER NOT NULL DEFAULT 0,
    "read_at"            TIMESTAMP(3),
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "study_notifications_organization_id_user_id_read_at_idx" ON "study_notifications"("organization_id", "user_id", "read_at");

ALTER TABLE "study_notifications"
    ADD CONSTRAINT "study_notifications_study_id_fkey"
    FOREIGN KEY ("study_id") REFERENCES "research_studies"("id") ON DELETE CASCADE;