-- CreateTable: GuidedAnalysisRun (V5 — Guided Statistical Analysis)
-- Tenant-scoped snapshot of a guided analysis execution.
-- Stores query/path/request/cohort/result JSON — never patient rows or identifiers.

CREATE TABLE "guided_analysis_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "query_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "cohort_context" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guided_analysis_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guided_analysis_runs_organization_id_createdAt_idx" ON "guided_analysis_runs"("organization_id", "createdAt");
CREATE INDEX "guided_analysis_runs_organization_id_created_by_idx" ON "guided_analysis_runs"("organization_id", "created_by");
CREATE INDEX "guided_analysis_runs_query_id_idx" ON "guided_analysis_runs"("query_id");
