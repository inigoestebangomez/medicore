-- CreateTable: patient_history_entries
CREATE TABLE "patient_history_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "entryType" "HistoryEntryType" NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "authorId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewState" "ReviewState" NOT NULL DEFAULT 'UNREVIEWED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_history_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: current_illness_entries
CREATE TABLE "current_illness_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "symptoms" TEXT NOT NULL,
    "durationValue" INTEGER,
    "durationUnit" "DurationUnit",
    "onset" TIMESTAMP(3),
    "evolution" TEXT,
    "narrative" TEXT,
    "consultationId" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "authorId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewState" "ReviewState" NOT NULL DEFAULT 'UNREVIEWED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "current_illness_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: physical_exam_templates
CREATE TABLE "physical_exam_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fields" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "physical_exam_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: physical_exam_records
CREATE TABLE "physical_exam_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "templateSchemaSnapshot" JSONB NOT NULL,
    "values" JSONB NOT NULL,
    "customFindings" JSONB NOT NULL DEFAULT '[]',
    "consultationId" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "authorId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewState" "ReviewState" NOT NULL DEFAULT 'UNREVIEWED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "physical_exam_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable: lab_reports
CREATE TABLE "lab_reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "ocrPayload" JSONB,
    "overallReviewState" "ReviewState" NOT NULL DEFAULT 'UNREVIEWED',
    "sourceType" TEXT NOT NULL DEFAULT 'ocr',
    "authorId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable: lab_results
CREATE TABLE "lab_results" (
    "id" TEXT NOT NULL,
    "labReportId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "referenceRange" TEXT,
    "reviewState" "ReviewState" NOT NULL DEFAULT 'UNREVIEWED',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable: diagnoses
CREATE TABLE "diagnoses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "system" "DiagnosisCodeSystem" NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "status" "DiagnosisStatus" NOT NULL DEFAULT 'ACTIVE',
    "variables" JSONB NOT NULL DEFAULT '{}',
    "consultationId" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "authorId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "discardedAt" TIMESTAMP(3),
    "discardedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

-- AlterTable: patients — add age semantics fields
ALTER TABLE "patients" ADD COLUMN "ageReferenceDate" JSONB;
ALTER TABLE "patients" ADD COLUMN "ageAtReferenceDate" INTEGER;

-- AlterTable: imaging_studies — add DICOM metadata fields
ALTER TABLE "imaging_studies" ADD COLUMN "dicomStudyInstanceUid" TEXT;
ALTER TABLE "imaging_studies" ADD COLUMN "dicomSeriesInstanceUid" TEXT;
ALTER TABLE "imaging_studies" ADD COLUMN "dicomSopInstanceUid" TEXT;
ALTER TABLE "imaging_studies" ADD COLUMN "dicomModality" TEXT;
ALTER TABLE "imaging_studies" ADD COLUMN "dicomStorageKey" TEXT;

-- AddForeignKey: patient_history_entries
ALTER TABLE "patient_history_entries" ADD CONSTRAINT "patient_history_entries_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: current_illness_entries
ALTER TABLE "current_illness_entries" ADD CONSTRAINT "current_illness_entries_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: physical_exam_records
ALTER TABLE "physical_exam_records" ADD CONSTRAINT "physical_exam_records_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: lab_reports
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: lab_results
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_labReportId_fkey"
    FOREIGN KEY ("labReportId") REFERENCES "lab_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: diagnoses
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex: patient_history_entries
CREATE INDEX "patient_history_entries_organizationId_patientId_idx"
    ON "patient_history_entries"("organizationId", "patientId");
CREATE INDEX "patient_history_entries_organizationId_patientId_entryType_idx"
    ON "patient_history_entries"("organizationId", "patientId", "entryType");

-- CreateIndex: current_illness_entries
CREATE INDEX "current_illness_entries_organizationId_patientId_idx"
    ON "current_illness_entries"("organizationId", "patientId");
CREATE INDEX "current_illness_entries_organizationId_patientId_createdAt_idx"
    ON "current_illness_entries"("organizationId", "patientId", "createdAt");

-- CreateIndex: physical_exam_templates
CREATE UNIQUE INDEX "physical_exam_templates_organizationId_specialty_version_key"
    ON "physical_exam_templates"("organizationId", "specialty", "version");
CREATE INDEX "physical_exam_templates_organizationId_specialty_idx"
    ON "physical_exam_templates"("organizationId", "specialty");

-- CreateIndex: physical_exam_records
CREATE INDEX "physical_exam_records_organizationId_patientId_idx"
    ON "physical_exam_records"("organizationId", "patientId");
CREATE INDEX "physical_exam_records_organizationId_patientId_createdAt_idx"
    ON "physical_exam_records"("organizationId", "patientId", "createdAt");
CREATE INDEX "physical_exam_records_templateId_templateVersion_idx"
    ON "physical_exam_records"("templateId", "templateVersion");

-- CreateIndex: lab_reports
CREATE INDEX "lab_reports_organizationId_patientId_idx"
    ON "lab_reports"("organizationId", "patientId");
CREATE INDEX "lab_reports_organizationId_patientId_createdAt_idx"
    ON "lab_reports"("organizationId", "patientId", "createdAt");
CREATE INDEX "lab_reports_organizationId_overallReviewState_idx"
    ON "lab_reports"("organizationId", "overallReviewState");

-- CreateIndex: lab_results
CREATE INDEX "lab_results_labReportId_idx"
    ON "lab_results"("labReportId");
CREATE INDEX "lab_results_labReportId_reviewState_idx"
    ON "lab_results"("labReportId", "reviewState");

-- CreateIndex: diagnoses
CREATE INDEX "diagnoses_organizationId_patientId_idx"
    ON "diagnoses"("organizationId", "patientId");
CREATE INDEX "diagnoses_organizationId_patientId_status_idx"
    ON "diagnoses"("organizationId", "patientId", "status");
CREATE INDEX "diagnoses_organizationId_system_code_idx"
    ON "diagnoses"("organizationId", "system", "code");

-- CreateIndex: imaging_studies DICOM
CREATE INDEX "imaging_studies_dicomStudyInstanceUid_idx"
    ON "imaging_studies"("dicomStudyInstanceUid");
