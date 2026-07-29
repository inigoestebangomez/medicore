-- Research Engine V2 — Foundation (Dashboard + ResearchQuery sharing)
-- Backward-compatible: new nullable columns + new table, no drops. Rollback-safe.

-- CreateTable: research_dashboards (design AD-2 — Dashboard owns widgets)
CREATE TABLE "research_dashboards" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "widgets" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "layout" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "research_dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "research_dashboards_organization_id_idx" ON "research_dashboards"("organization_id");
CREATE INDEX "research_dashboards_organization_id_created_by_idx" ON "research_dashboards"("organization_id", "created_by");

-- AlterTable: extend ResearchQuery with sharing (AD-2 backward-compat with v1 sharedWith)
ALTER TABLE "research_queries" ADD COLUMN "sharing" JSONB NOT NULL DEFAULT '{"users":[],"permission":"view"}'::jsonb;
ALTER TABLE "research_queries" ADD COLUMN "dashboard_id" TEXT;

-- Self-reference: ResearchQuery.widgetsQueries ↔ Dashboard (live-reference widgets)
ALTER TABLE "research_queries" ADD CONSTRAINT "research_queries_dashboard_id_fkey"
    FOREIGN KEY ("dashboard_id") REFERENCES "research_dashboards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "research_queries_dashboard_id_idx" ON "research_queries"("dashboard_id");

-- GIN optimization for cross-tab / field-discovery push-down (design infra).
-- jsonb_path_ops is the most compact & query-efficient GIN opclass for existence
-- and containment queries used by FieldDiscoveryService / CrossTabService.
CREATE INDEX IF NOT EXISTS "idx_patients_imported_data_path"
    ON "patients" USING gin ("imported_data" jsonb_path_ops);