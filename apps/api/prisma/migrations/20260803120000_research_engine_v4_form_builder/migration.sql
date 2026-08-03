-- Research Engine V4 — Form Builder (additive schema)
-- REQ-FB-001..012: StudyVariable, VariableTemplate, StudyVariableLink,
-- StudySubject, StatisticalAnalysis. ResearchStudy gains nullable query_id +
-- study_type (default QUERY). Existing rows: query_id stays non-null, study_type=QUERY.
-- Risk: nil — columns new with DEFAULT and/or nullable; no existing row touched.

-- ─────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE "StudyType" AS ENUM ('QUERY', 'FORM', 'HYBRID');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE "VariableType" AS ENUM ('CONTINUOUS', 'DISCRETE', 'DICHOTOMOUS', 'NOMINAL', 'ORDINAL', 'TIME_TO_EVENT');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE "VariableScope" AS ENUM ('CORE', 'CUSTOM');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE "AnalysisTest" AS ENUM ('KAPPA', 'ICC', 'CRONBACH', 'LOGISTIC', 'COX', 'KAPLAN_MEIER', 'T_TEST', 'MANN_WHITNEY', 'CHI_SQUARE', 'FISHER', 'ANOVA', 'PEARSON', 'SPEARMAN', 'WILCOXON', 'KRUSKAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE "RiskFactorLabel" AS ENUM ('RISK_FACTOR', 'PROTECTIVE_FACTOR', 'NEUTRAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- ResearchStudy — modify query_id nullable + add study_type
-- ─────────────────────────────────────────────
ALTER TABLE "research_studies" ALTER COLUMN "query_id" DROP NOT NULL;
ALTER TABLE "research_studies" ADD COLUMN IF NOT EXISTS "study_type" "StudyType" NOT NULL DEFAULT 'QUERY';

-- Drop & recreate the query FK to allow nullable + RESTRICT (was non-null RESTRICT)
ALTER TABLE "research_studies" DROP CONSTRAINT IF EXISTS "research_studies_query_id_fkey";
DO $$ BEGIN
    ALTER TABLE "research_studies"
        ADD CONSTRAINT "research_studies_query_id_fkey"
        FOREIGN KEY ("query_id") REFERENCES "research_queries"("id") ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "research_studies_organization_id_study_type_status_idx"
    ON "research_studies"("organization_id", "study_type", "status");

-- ─────────────────────────────────────────────
-- study_variables
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "study_variables" (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "study_id"        TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "label"           TEXT NOT NULL,
    "type"            "VariableType" NOT NULL,
    "scope"           "VariableScope" NOT NULL DEFAULT 'CUSTOM',
    "unit"            TEXT,
    "required"        BOOLEAN NOT NULL DEFAULT false,
    "is_core"         BOOLEAN NOT NULL DEFAULT false,
    "position"        INTEGER NOT NULL DEFAULT 0,
    "options"         JSONB,
    "range"           JSONB,
    "parent_id"       TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_variables_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "study_variables_study_id_position_idx"
    ON "study_variables"("study_id", "position");
CREATE INDEX IF NOT EXISTS "study_variables_organization_id_type_idx"
    ON "study_variables"("organization_id", "type");

ALTER TABLE "study_variables"
    ADD CONSTRAINT "study_variables_study_id_fkey"
    FOREIGN KEY ("study_id") REFERENCES "research_studies"("id") ON DELETE CASCADE;

ALTER TABLE "study_variables"
    ADD CONSTRAINT "study_variables_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "study_variables"("id") ON DELETE SET NULL;

-- ─────────────────────────────────────────────
-- variable_templates
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "variable_templates" (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by"      TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "type"            "VariableType" NOT NULL,
    "unit"            TEXT,
    "options"         JSONB,
    "range"           JSONB,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variable_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "variable_templates_organization_id_name_key" UNIQUE ("organization_id", "name")
);

ALTER TABLE "variable_templates"
    ADD CONSTRAINT "variable_templates_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;

-- ─────────────────────────────────────────────
-- study_variable_links (snapshot: composite PK templateId+studyVarId)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "study_variable_links" (
    "template_id"        TEXT NOT NULL,
    "study_id"           TEXT NOT NULL,
    "study_variable_id"  TEXT NOT NULL,

    CONSTRAINT "study_variable_links_pkey" PRIMARY KEY ("template_id", "study_variable_id")
);

CREATE INDEX IF NOT EXISTS "study_variable_links_study_id_idx"
    ON "study_variable_links"("study_id");

ALTER TABLE "study_variable_links"
    ADD CONSTRAINT "study_variable_links_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "variable_templates"("id") ON DELETE CASCADE;
ALTER TABLE "study_variable_links"
    ADD CONSTRAINT "study_variable_links_study_id_fkey"
    FOREIGN KEY ("study_id") REFERENCES "research_studies"("id") ON DELETE CASCADE;
ALTER TABLE "study_variable_links"
    ADD CONSTRAINT "study_variable_links_study_variable_id_fkey"
    FOREIGN KEY ("study_variable_id") REFERENCES "study_variables"("id") ON DELETE CASCADE;

-- ─────────────────────────────────────────────
-- study_subjects (JSONB values + GIN)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "study_subjects" (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "study_id"        TEXT NOT NULL,
    "patient_id"      TEXT,
    "patient_nhc"    TEXT NOT NULL,
    "values"         JSONB NOT NULL DEFAULT '{}',
    "auto_fill_map"  JSONB NOT NULL DEFAULT '{}',
    "enrolled_by"    TEXT NOT NULL,
    "enrolled_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_subjects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "study_subjects_study_id_patient_id_key" UNIQUE ("study_id", "patient_id")
);

CREATE INDEX IF NOT EXISTS "study_subjects_organization_id_study_id_idx"
    ON "study_subjects"("organization_id", "study_id");
CREATE INDEX IF NOT EXISTS "study_subjects_values_idx" ON "study_subjects" USING GIN ("values");

ALTER TABLE "study_subjects"
    ADD CONSTRAINT "study_subjects_study_id_fkey"
    FOREIGN KEY ("study_id") REFERENCES "research_studies"("id") ON DELETE CASCADE;
ALTER TABLE "study_subjects"
    ADD CONSTRAINT "study_subjects_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL;

-- ─────────────────────────────────────────────
-- statistical_analyses (traceability)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "statistical_analyses" (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "study_id"        TEXT NOT NULL,
    "test"            "AnalysisTest" NOT NULL,
    "variable_ids"    TEXT[] NOT NULL,
    "params"          JSONB NOT NULL DEFAULT '{}',
    "statistic"       DOUBLE PRECISION,
    "p_value"         DOUBLE PRECISION,
    "ci_95"           JSONB,
    "effect_size"     JSONB,
    "n"               INTEGER NOT NULL,
    "risk_label"      "RiskFactorLabel",
    "executed_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statistical_analyses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "statistical_analyses_study_id_executed_at_idx"
    ON "statistical_analyses"("study_id", "executed_at");
CREATE INDEX IF NOT EXISTS "statistical_analyses_organization_id_test_executed_at_idx"
    ON "statistical_analyses"("organization_id", "test", "executed_at");

ALTER TABLE "statistical_analyses"
    ADD CONSTRAINT "statistical_analyses_study_id_fkey"
    FOREIGN KEY ("study_id") REFERENCES "research_studies"("id") ON DELETE CASCADE;