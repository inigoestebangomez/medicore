-- CreateTable
CREATE TABLE "research_queries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dataSource" TEXT NOT NULL DEFAULT 'all_patients',
    "importBatchIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "filters" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "filterLogic" TEXT NOT NULL DEFAULT 'AND',
    "displayFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "visualizations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sharedWith" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "lastRunAt" TIMESTAMPTZ(6),
    "lastRunCount" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "research_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_collections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "query_id" TEXT,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "patient_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_collection_members" (
    "collection_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "patient_collection_members_pkey" PRIMARY KEY ("collection_id","patient_id")
);

-- CreateIndex
CREATE INDEX "research_queries_organization_id_idx" ON "research_queries"("organization_id");

-- CreateIndex
CREATE INDEX "research_queries_organization_id_created_by_idx" ON "research_queries"("organization_id", "created_by");

-- CreateIndex
CREATE INDEX "research_queries_organization_id_created_at_idx" ON "research_queries"("organization_id", "createdAt");

-- CreateIndex
CREATE INDEX "patient_collections_organization_id_idx" ON "patient_collections"("organization_id");

-- CreateIndex
CREATE INDEX "patient_collections_organization_id_created_by_idx" ON "patient_collections"("organization_id", "created_by");

-- CreateIndex
CREATE INDEX "patient_collection_members_collection_id_idx" ON "patient_collection_members"("collection_id");

-- CreateIndex
CREATE INDEX "patient_collection_members_patient_id_idx" ON "patient_collection_members"("patient_id");

-- AddForeignKey
ALTER TABLE "research_queries" ADD CONSTRAINT "research_queries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "research_queries" ADD CONSTRAINT "research_queries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_collections" ADD CONSTRAINT "patient_collections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patient_collections" ADD CONSTRAINT "patient_collections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patient_collections" ADD CONSTRAINT "patient_collections_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "research_queries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_collection_members" ADD CONSTRAINT "patient_collection_members_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "patient_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "patient_collection_members" ADD CONSTRAINT "patient_collection_members_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patient_collection_members" ADD CONSTRAINT "patient_collection_members_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
