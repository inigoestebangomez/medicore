# 02-data-schema.md

## MediCore — Modelo de Datos

> **Versión:** 1.0 | **Estado:** Aprobado | **Fecha:** 2026-06
> **Prerequisito:** `01-architecture.md` aprobado

---

## Índice

1. [Principios del Modelo de Datos](#1-principios-del-modelo-de-datos)
2. [Diagrama Entidad-Relación](#2-diagrama-entidad-relación)
3. [Schema Prisma Completo](#3-schema-prisma-completo)
4. [Descripción de Entidades](#4-descripción-de-entidades)
5. [Índices y Rendimiento](#5-índices-y-rendimiento)
6. [Codificación Clínica: CIE-10 y SNOMED](#6-codificación-clínica-cie-10-y-snomed)
7. [Política de Retención y RGPD](#7-política-de-retención-y-rgpd)
8. [Migraciones y Evolución del Schema](#8-migraciones-y-evolución-del-schema)
9. [Seed de Datos para Desarrollo y Tests](#9-seed-de-datos-para-desarrollo-y-tests)

---

## 1. Principios del Modelo de Datos

**Aislamiento por organización:** Cada tabla clínica tiene `organizationId NOT NULL`. No existen datos clínicos huérfanos de organización. Un middleware global de Prisma verifica en runtime que todas las queries incluyen este filtro.

**UUIDs como identificadores primarios:** Todos los IDs son UUID v4. Evita la exposición de IDs secuenciales en URLs (no se puede inferir el volumen de pacientes de una clínica) y facilita la generación de IDs en cliente antes de persistir.

**Soft delete en datos clínicos:** Los registros clínicos nunca se borran físicamente. `deletedAt` timestamp marca el borrado lógico. Los registros borrados no aparecen en queries normales (middleware Prisma) pero se conservan para auditoría y cumplimiento legal (Ley 41/2002 — historia clínica mínimo 5 años).

**Timestamps auditables en todas las tablas:** `createdAt`, `updatedAt`, y `deletedAt` en todas las entidades. `createdBy` y `updatedBy` en entidades clínicas críticas.

**JSONB para datos flexibles ORL:** Los formularios clínicos (escalas validadas, notas de exploración física, parámetros audiométricos) se almacenan en campos `JSONB`. El schema de estos JSONB está validado por Zod en la capa de aplicación, nunca a nivel de base de datos — esto permite evolucionar los formularios sin migraciones.

**Datos personales mínimos:** Solo se almacenan los datos estrictamente necesarios para la atención clínica (principio de minimización RGPD Art. 5.1.c).

---

## 2. Diagrama Entidad-Relación

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           IDENTITY & TENANCY                                │
│                                                                             │
│  ┌──────────┐     ┌────────────────────┐     ┌──────────┐                  │
│  │   User   │────<│ OrganizationMember │>────│  Organ.  │                  │
│  │          │  1  │                    │  1  │          │                  │
│  │ id       │     │ userId             │     │ id       │                  │
│  │ email    │     │ organizationId     │     │ name     │                  │
│  │ name     │     │ role               │     │ type     │                  │
│  │ provider │     │ joinedAt           │     │ plan     │                  │
│  └──────────┘     └────────────────────┘     └────┬─────┘                  │
│                                                   │ 1                      │
└───────────────────────────────────────────────────┼─────────────────────────┘
                                                    │
┌───────────────────────────────────────────────────┼─────────────────────────┐
│                         CLINICAL CORE             │                         │
│                                                   │ N                       │
│                                              ┌────▼─────────────────────┐   │
│                                              │        Patient           │   │
│                                              │                          │   │
│                                              │ id, organizationId       │   │
│                                              │ nhc (nº historia clínica)│   │
│                                              │ firstName, lastName      │   │
│                                              │ birthDate, sex           │   │
│                                              │ idDocument, idDocType    │   │
│                                              │ phone, email             │   │
│                                              │ address (JSONB)          │   │
│                                              │ emergencyContact (JSONB) │   │
│                                              │ bloodType                │   │
│                                              │ notes                    │   │
│                                              └──┬──────┬──────┬────┬────┘   │
│                                                 │      │      │    │        │
│              ┌──────────────────────────────────┘      │      │    │        │
│              │                    ┌───────────────────-┘      │    │        │
│              │                    │      ┌────────────────────┘    │        │
│              │ N                  │ N    │ N                        │ N      │
│     ┌────────▼──────┐    ┌────────▼──┐  │  ┌──────────┐   ┌───────▼──────┐ │
│     │ Consultation  │    │  Surgery  │  │  │ Imaging  │   │  Medication  │ │
│     │               │    │           │  │  │  Study   │   │  Prescription│ │
│     │ id, orgId     │    │ id, orgId │  │  │          │   │              │ │
│     │ patientId     │    │ patientId │  │  │ id,orgId │   │ id, orgId    │ │
│     │ date, type    │    │ date      │  │  │ patientId│   │ patientId    │ │
│     │ chiefComplaint│    │ type      │  │  │ type     │   │ drugName     │ │
│     │ examination   │    │ technique │  │  │ date     │   │ dosage       │ │
│     │ (JSONB)       │    │ (JSONB)   │  │  │ files[]  │   │ startDate    │ │
│     │ assessment    │    │ notes     │  │  │ notes    │   │ endDate      │ │
│     │ plan          │    │ outcome   │  │  │ labels[] │   │ status       │ │
│     │ diagnosisCodes│    │ asa       │  │  └────┬─────┘   └──────────────┘ │
│     │ (JSONB)       │    └─────┬─────┘  │       │                          │
│     └───────┬───────┘         │         │       │ N                        │
│             │ N               │ N        └──┐   │                          │
│             └─────────────────┘             │   │                          │
│                      │                      │   │                          │
│                      │ N           ┌─────────▼───▼──┐                      │
│                      └────────────▶│    Report      │                      │
│                                    │                │                      │
│                                    │ id, orgId      │                      │
│                                    │ patientId      │                      │
│                                    │ sourceType     │                      │
│                                    │ sourceId       │                      │
│                                    │ content        │                      │
│                                    │ diagnosisCodes │                      │
│                                    │ procedureCodes │                      │
│                                    │ status         │                      │
│                                    │ pdfUrl         │                      │
│                                    └────────────────┘                      │
│                                                                             │
│  ┌──────────────────────┐    ┌──────────────────────┐                      │
│  │       Allergy        │    │   ClinicalScale       │                      │
│  │ (N per patient)      │    │ (N per consultation)  │                      │
│  │                      │    │                       │                      │
│  │ id, orgId, patientId │    │ id, orgId, patientId  │                      │
│  │ substance            │    │ consultationId        │                      │
│  │ reaction             │    │ scaleType             │                      │
│  │ severity             │    │ scores (JSONB)        │                      │
│  │ verified             │    │ date                  │                      │
│  └──────────────────────┘    └──────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          AUDIT & COMPLIANCE                                 │
│                                                                             │
│  ┌──────────────────────┐    ┌──────────────────────┐                      │
│  │      AuditLog        │    │   ConsentRecord       │                      │
│  │                      │    │                       │                      │
│  │ id, orgId, userId    │    │ id, orgId, patientId  │                      │
│  │ action               │    │ consentType           │                      │
│  │ entityType           │    │ grantedAt             │                      │
│  │ entityId             │    │ revokedAt             │                      │
│  │ changes (JSONB)      │    │ documentUrl           │                      │
│  │ ipAddress            │    │ signatureData         │                      │
│  │ userAgent            │    └──────────────────────┘                      │
│  │ timestamp            │                                                   │
│  └──────────────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Schema Prisma Completo

```prisma
// apps/api/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// IDENTITY & TENANCY
// ─────────────────────────────────────────────

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  name          String
  avatarUrl     String?
  oauthProvider String   // "google" | "microsoft" | "credentials"
  oauthSub      String?  // Subject claim del proveedor OAuth
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  memberships   OrganizationMember[]
  auditLogs     AuditLog[]

  @@index([email])
  @@map("users")
}

model Organization {
  id          String           @id @default(uuid())
  name        String
  slug        String           @unique  // para URLs amigables: app.MediCore.com/[slug]
  type        OrganizationType @default(SOLO_PRACTICE)
  plan        PlanType         @default(FREE)
  settings    Json             @default("{}")  // configuración del workspace
  logoUrl     String?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  deletedAt   DateTime?        // soft delete

  members     OrganizationMember[]
  patients    Patient[]
  auditLogs   AuditLog[]
  consents    ConsentRecord[]

  @@index([slug])
  @@map("organizations")
}

model OrganizationMember {
  id             String           @id @default(uuid())
  organizationId String
  userId         String
  role           MemberRole       @default(PHYSICIAN)
  invitedBy      String?          // userId del que invitó
  joinedAt       DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  organization   Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])  // un usuario solo puede tener un rol por organización
  @@index([organizationId])
  @@index([userId])
  @@map("organization_members")
}

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

enum OrganizationType {
  CLINIC           // Clínica con varios médicos
  SOLO_PRACTICE    // Médico liberal autónomo
  HOSPITAL_DEPT    // Unidad hospitalaria
}

enum PlanType {
  FREE
  PRO
  ENTERPRISE
}

enum MemberRole {
  OWNER
  PHYSICIAN
  VIEWER
  ADMIN
}

enum Sex {
  MALE
  FEMALE
  OTHER
  UNKNOWN
}

enum IdDocumentType {
  DNI
  NIE
  PASSPORT
  OTHER
}

enum BloodType {
  A_POS
  A_NEG
  B_POS
  B_NEG
  AB_POS
  AB_NEG
  O_POS
  O_NEG
  UNKNOWN
}

enum AllergySeverity {
  MILD
  MODERATE
  SEVERE
  ANAPHYLAXIS
}

enum AllergyStatus {
  ACTIVE
  INACTIVE
  UNCONFIRMED
}

enum ConsultationType {
  FIRST_VISIT       // Primera consulta
  FOLLOW_UP         // Revisión
  URGENCY           // Urgencia
  POST_OP           // Postoperatoria
  TELECONSULTATION  // Teleconsulta
}

enum SurgeryStatus {
  SCHEDULED
  COMPLETED
  CANCELLED
  POSTPONED
}

enum AsaClassification {
  ASA_I
  ASA_II
  ASA_III
  ASA_IV
  ASA_V
  ASA_VI
}

enum ImagingStudyType {
  CT_SCAN             // TAC
  MRI                 // Resonancia magnética
  XRAY                // Radiografía
  ENDOSCOPY           // Endoscopia
  NASOFIBROSCOPY      // Nasofibroscopia
  LARYNGOSCOPY        // Laringoscopia
  AUDIOGRAM           // Audiometría
  TYMPANOGRAM         // Impedanciometría
  ABR                 // Potenciales evocados auditivos
  VIDEONYSTAGMOGRAPHY // Videonistagmografía
  VHIT                // Video Head Impulse Test
  ULTRASOUND          // Ecografía
  OTHER
}

enum MedicationStatus {
  ACTIVE
  DISCONTINUED
  COMPLETED
  ON_HOLD
}

enum ReportType {
  DISCHARGE_SUMMARY       // Informe de alta
  SURGICAL_REPORT         // Informe quirúrgico
  REFERRAL_LETTER         // Carta de derivación
  MEDICAL_CERTIFICATE     // Certificado médico
  FOLLOW_UP_REPORT        // Informe de revisión
  PATHOLOGY_REPORT        // Informe de anatomía patológica
}

enum ReportStatus {
  DRAFT         // Generado por IA, pendiente de revisión
  REVIEWED      // Revisado por el médico
  SIGNED        // Firmado (estado final)
}

enum ClinicalScaleType {
  SNOT_22           // Sino-Nasal Outcome Test (rinosinusitis)
  VAS_TINNITUS      // Escala visual analógica para acúfenos
  DHI               // Dizziness Handicap Inventory (vértigo)
  VHI               // Voice Handicap Index (disfonía)
  RSI               // Reflux Symptom Index
  OSA_EPWORTH       // Escala de somnolencia de Epworth (SAOS)
  STOPBANG          // Cuestionario STOP-BANG (apnea del sueño)
  NOSE              // Nasal Obstruction Symptom Evaluation
  CUSTOM            // Escala personalizada del médico
}

enum ConsentType {
  TREATMENT         // Consentimiento de tratamiento general
  SURGERY           // Consentimiento quirúrgico específico
  DATA_PROCESSING   // Consentimiento RGPD tratamiento de datos
  PHOTOGRAPHY       // Consentimiento para fotografías/vídeos clínicos
  RESEARCH          // Consentimiento para uso en investigación
}

// ─────────────────────────────────────────────
// CLINICAL CORE
// ─────────────────────────────────────────────

model Patient {
  id             String         @id @default(uuid())
  organizationId String
  nhc            String         // Nº Historia Clínica — único por organización

  // Datos demográficos
  firstName      String
  lastName       String
  birthDate      DateTime
  sex            Sex
  idDocument     String?        // Número del documento de identidad
  idDocType      IdDocumentType @default(DNI)

  // Contacto
  phone          String?
  email          String?
  address        Json?          // { street, city, province, postalCode, country }
  emergencyContact Json?        // { name, relationship, phone }

  // Clínico
  bloodType      BloodType      @default(UNKNOWN)
  notes          String?        // Notas libres del médico sobre el paciente

  // Metadata
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  deletedAt      DateTime?
  createdBy      String         // userId
  updatedBy      String?        // userId

  // Relaciones
  organization   Organization   @relation(fields: [organizationId], references: [id])
  allergies      Allergy[]
  consultations  Consultation[]
  surgeries      Surgery[]
  imagingStudies ImagingStudy[]
  medications    MedicationPrescription[]
  reports        Report[]
  scales         ClinicalScale[]
  consents       ConsentRecord[]

  @@unique([organizationId, nhc])         // El NHC es único dentro de la organización
  @@index([organizationId])
  @@index([organizationId, lastName, firstName])
  @@index([organizationId, birthDate])
  @@index([organizationId, idDocument])
  @@map("patients")
}

model Allergy {
  id             String          @id @default(uuid())
  organizationId String
  patientId      String

  substance      String          // Nombre del alérgeno (ej: "Amoxicilina", "Látex")
  substanceCode  String?         // Código SNOMED CT del alérgeno si disponible
  reaction       String?         // Descripción de la reacción
  severity       AllergySeverity @default(MODERATE)
  status         AllergyStatus   @default(ACTIVE)
  onsetDate      DateTime?
  notes          String?

  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  deletedAt      DateTime?
  createdBy      String

  patient        Patient         @relation(fields: [patientId], references: [id])

  @@index([organizationId, patientId])
  @@map("allergies")
}

model Consultation {
  id             String           @id @default(uuid())
  organizationId String
  patientId      String

  date           DateTime
  type           ConsultationType @default(FIRST_VISIT)
  physicianId    String           // userId del médico que realiza la consulta

  // Contenido clínico
  chiefComplaint String           // Motivo de consulta
  currentIllness String?          // Enfermedad actual / anamnesis

  // Exploración física ORL (JSONB flexible)
  // Estructura esperada: { rhinoscopy, otoscopy, oropharynx, neck, laryngoscopy, ... }
  physicalExam   Json?

  // Escalas clínicas vinculadas: se gestionan en ClinicalScale

  // Diagnóstico
  assessment     String?          // Impresión diagnóstica en texto libre
  diagnosisCodes Json?            // [{ system: "ICD10"|"SNOMED", code, description, type: "primary"|"secondary" }]

  // Plan
  plan           String?          // Plan de tratamiento en texto libre
  procedureCodes Json?            // [{ system: "ICD10PCS"|"SNOMED", code, description }]

  // Follow-up
  followUpDate   DateTime?
  followUpNotes  String?

  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  deletedAt      DateTime?
  createdBy      String
  updatedBy      String?

  patient        Patient          @relation(fields: [patientId], references: [id])
  scales         ClinicalScale[]
  reports        Report[]

  @@index([organizationId])
  @@index([organizationId, patientId])
  @@index([organizationId, date])
  @@index([organizationId, physicianId])
  @@map("consultations")
}

model ClinicalScale {
  id             String           @id @default(uuid())
  organizationId String
  patientId      String
  consultationId String?          // Opcional: puede existir sin consulta asociada

  scaleType      ClinicalScaleType
  date           DateTime         @default(now())

  // Puntuaciones específicas de la escala (JSONB)
  // SNOT-22: { q1: 0-5, q2: 0-5, ..., q22: 0-5, total: 0-110 }
  // DHI: { physical: 0-28, functional: 0-28, emotional: 0-28, total: 0-100 }
  // VAS_TINNITUS: { intensity: 0-10, distress: 0-10, sleepImpact: 0-10 }
  scores         Json

  notes          String?
  createdAt      DateTime         @default(now())
  createdBy      String

  patient        Patient          @relation(fields: [patientId], references: [id])
  consultation   Consultation?    @relation(fields: [consultationId], references: [id])

  @@index([organizationId, patientId])
  @@index([organizationId, patientId, scaleType])
  @@map("clinical_scales")
}

model Surgery {
  id             String           @id @default(uuid())
  organizationId String
  patientId      String
  physicianId    String           // userId del cirujano principal

  // Datos del procedimiento
  date           DateTime
  status         SurgeryStatus    @default(SCHEDULED)
  procedureType  String           // Nombre del procedimiento (ej: "Septoplastia + CENS bilateral")
  procedureCodes Json?            // [{ system: "ICD10PCS"|"SNOMED", code, description }]

  // Clasificación anestésica
  asa            AsaClassification?
  anesthesiaType String?          // "General" | "Local" | "Sedación" | "Regional"

  // Pre-operatorio
  preOpNotes     String?
  preOpChecklist Json?            // { bloodwork: bool, consent: bool, fasting: bool, ... }

  // Intraoperatorio
  duration       Int?             // Duración en minutos
  technique      Json?            // Notas de técnica quirúrgica (JSONB flexible por tipo de cirugía)
  findings       String?          // Hallazgos intraoperatorios
  complications  String?

  // Post-operatorio
  postOpNotes    String?
  postOpProtocol Json?            // Protocolo de revisiones postoperatorias

  // Outcome
  outcome        String?

  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  deletedAt      DateTime?
  createdBy      String
  updatedBy      String?

  patient        Patient          @relation(fields: [patientId], references: [id])
  imagingStudies ImagingStudy[]
  reports        Report[]

  @@index([organizationId])
  @@index([organizationId, patientId])
  @@index([organizationId, date])
  @@index([organizationId, physicianId])
  @@map("surgeries")
}

model ImagingStudy {
  id             String           @id @default(uuid())
  organizationId String
  patientId      String
  surgeryId      String?          // Opcional: puede vincularse a una cirugía
  consultationId String?          // Opcional: puede vincularse a una consulta

  type           ImagingStudyType
  date           DateTime
  description    String?

  // Anotaciones clínicas sobre el estudio
  findings       String?
  labels         Json?            // [{ label: string, coordinates?: {...} }]

  // Archivo(s) almacenados en R2
  // Cada file: { key: string (R2 key), name: string, mimeType: string, sizeBytes: number }
  files          Json             @default("[]")

  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  deletedAt      DateTime?
  createdBy      String

  patient        Patient          @relation(fields: [patientId], references: [id])
  surgery        Surgery?         @relation(fields: [surgeryId], references: [id])

  @@index([organizationId, patientId])
  @@index([organizationId, type])
  @@map("imaging_studies")
}

model MedicationPrescription {
  id             String           @id @default(uuid())
  organizationId String
  patientId      String
  consultationId String?          // Consulta en la que se prescribió
  physicianId    String

  drugName       String           // Nombre del medicamento
  drugCode       String?          // Código ATC o CN (Código Nacional)
  activeIngredient String?        // Principio activo
  dosage         String           // Ej: "500mg"
  frequency      String           // Ej: "cada 8 horas"
  route          String?          // Ej: "oral", "tópico nasal", "IV"
  form           String?          // Ej: "comprimidos", "spray nasal"

  startDate      DateTime
  endDate        DateTime?        // null = tratamiento crónico
  duration       String?          // Descripción textual: "10 días", "3 meses"

  status         MedicationStatus @default(ACTIVE)
  instructions   String?          // Instrucciones especiales para el paciente
  reason         String?          // Indicación / diagnóstico que motiva la prescripción

  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  deletedAt      DateTime?
  createdBy      String

  patient        Patient          @relation(fields: [patientId], references: [id])

  @@index([organizationId, patientId])
  @@index([organizationId, patientId, status])
  @@map("medication_prescriptions")
}

model Report {
  id             String       @id @default(uuid())
  organizationId String
  patientId      String
  physicianId    String

  type           ReportType
  status         ReportStatus @default(DRAFT)

  // Fuente del informe (polimórfico)
  sourceType     String?      // "consultation" | "surgery" | "manual"
  sourceId       String?      // ID de la consulta o cirugía origen

  // Contenido
  title          String
  content        String       // Texto del informe (Markdown o texto plano)

  // Codificación clínica incluida en el informe
  diagnosisCodes Json?        // [{ system, code, description, type }]
  procedureCodes Json?        // [{ system, code, description }]

  // Generación IA
  aiGenerated    Boolean      @default(false)
  aiModel        String?      // "claude-sonnet-4-20250514"
  aiPromptHash   String?      // Hash del prompt usado (para reproducibilidad y auditoría)

  // PDF generado
  pdfUrl         String?      // URL firmada del PDF en R2
  pdfGeneratedAt DateTime?

  // Firma
  signedAt       DateTime?
  signedBy       String?      // userId

  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  deletedAt      DateTime?
  createdBy      String
  updatedBy      String?

  patient        Patient      @relation(fields: [patientId], references: [id])
  consultation   Consultation? @relation(fields: [sourceId], references: [id], map: "report_consultation_fk")
  surgery        Surgery?     @relation(fields: [sourceId], references: [id], map: "report_surgery_fk")

  @@index([organizationId])
  @@index([organizationId, patientId])
  @@index([organizationId, status])
  @@map("reports")
}

// ─────────────────────────────────────────────
// AUDIT & COMPLIANCE
// ─────────────────────────────────────────────

model AuditLog {
  id             String   @id @default(uuid())
  organizationId String
  userId         String

  action         String   // "CREATE" | "UPDATE" | "DELETE" | "VIEW" | "EXPORT" | "LOGIN"
  entityType     String   // "Patient" | "Consultation" | "Surgery" | etc.
  entityId       String?  // ID del registro afectado

  // Cambios realizados (para UPDATE)
  // { before: {...}, after: {...} } — solo campos modificados
  changes        Json?

  // Contexto de la petición
  ipAddress      String?
  userAgent      String?
  requestId      String?  // Para correlación de logs

  timestamp      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  user           User         @relation(fields: [userId], references: [id])

  // Audit log NUNCA tiene soft delete — es inmutable por definición
  @@index([organizationId, timestamp])
  @@index([organizationId, entityType, entityId])
  @@index([organizationId, userId])
  @@map("audit_logs")
}

model ConsentRecord {
  id             String      @id @default(uuid())
  organizationId String
  patientId      String

  consentType    ConsentType
  grantedAt      DateTime    @default(now())
  revokedAt      DateTime?   // null = consentimiento activo

  // Documento firmado (almacenado en R2)
  documentUrl    String?
  signatureData  Json?       // { method: "digital"|"ink", hash: string, ip: string }

  // Quién recogió el consentimiento
  collectedBy    String      // userId

  notes          String?

  organization   Organization @relation(fields: [organizationId], references: [id])
  patient        Patient      @relation(fields: [patientId], references: [id])

  @@index([organizationId, patientId])
  @@index([organizationId, patientId, consentType])
  @@map("consent_records")
}
```

---

## 4. Descripción de Entidades

### Patient

Entidad central del sistema. El `nhc` (Número de Historia Clínica) es generado por la aplicación y es único dentro de cada organización — no es el número de historia del hospital (que puede no existir para médicos liberales). El campo `address` y `emergencyContact` son JSONB para evitar tablas adicionales con datos de escasa complejidad relacional.

Los datos de identidad (`idDocument`, `phone`, `email`) son opcionales por diseño: muchos pacientes de clínicas privadas ORL son referidos sin datos de contacto completos. La aplicación no los requiere para funcionar.

### Consultation

El corazón del flujo diario del médico. El campo `physicalExam` como JSONB es una decisión deliberada: la exploración física ORL varía mucho según la visita (no se hace nasofibroscopia en todas las consultas). El schema del JSONB está validado en la capa de aplicación con Zod. Estructura esperada por especialidad:

```json
// physicalExam para ORL
{
  "otoscopy": {
    "right": { "membrane": "intact", "notes": "..." },
    "left": { "membrane": "perforated", "quadrant": "posterosuperior", "notes": "..." }
  },
  "rhinoscopy": {
    "anterior": "...",
    "endoscopic": "...",
    "septum": "deviated_right"
  },
  "oropharynx": {
    "tonsils": "grade_II",
    "posterior_wall": "..."
  },
  "laryngoscopy": {
    "vocalCords": "normal",
    "mobility": "bilateral_normal",
    "notes": "..."
  },
  "neck": {
    "lymphNodes": "no_palpable",
    "thyroid": "normal"
  }
}
```

### Surgery

Gestiona el ciclo completo de una intervención quirúrgica ORL. El campo `technique` como JSONB permite formularios específicos por tipo de cirugía sin proliferación de tablas:

```json
// technique para Septoplastia
{
  "approach": "endonasal",
  "grafts": ["cartilage"],
  "turbinoplasty": true,
  "turbinoplastyType": "submucosal",
  "hemostasis": "bipolar",
  "packing": "bilateral_merocel"
}

// technique para Timpanoplastia
{
  "approach": "retroauricular",
  "graftMaterial": "temporalis_fascia",
  "perforationSize": "subtotal",
  "ossicularChain": "intact",
  "prosthesis": false
}
```

### ImagingStudy

Los archivos físicos residen en Cloudflare R2. El campo `files` JSONB almacena las referencias (claves R2, nombres originales, tipos MIME y tamaños). La URL real para visualizar el archivo se genera como URL pre-firmada en cada petición — nunca se almacena la URL firmada en base de datos.

### Report

Gestiona tanto los informes generados por IA (estado `DRAFT` → revisión → `SIGNED`) como los escritos manualmente. El campo `aiPromptHash` permite auditar qué contexto clínico se usó para generar el informe — importante para validación clínica y para reproducibilidad.

### AuditLog

Tabla inmutable. No tiene `deletedAt` ni permite UPDATE. Solo inserciones. El interceptor de NestJS registra automáticamente toda operación de escritura en datos clínicos. Las lecturas (`VIEW`) solo se registran para operaciones sensibles: exportación de paciente, visualización de informes firmados, acceso a imágenes.

---

## 5. Índices y Rendimiento

### Índices críticos

Todos los índices incluyen `organizationId` como primer campo — esto es fundamental para el rendimiento en multi-tenant. Una query sin `organizationId` en el WHERE haría un full table scan.

```sql
-- Las queries más frecuentes y sus índices:

-- Listar pacientes de una organización (con búsqueda por nombre)
CREATE INDEX idx_patients_org_name ON patients(organization_id, last_name, first_name)
  WHERE deleted_at IS NULL;

-- Timeline clínica de un paciente
CREATE INDEX idx_consultations_patient ON consultations(organization_id, patient_id, date DESC)
  WHERE deleted_at IS NULL;

-- Dashboard de analíticas (agrupación por fecha)
CREATE INDEX idx_surgeries_org_date ON surgeries(organization_id, date)
  WHERE deleted_at IS NULL;

-- Búsqueda de pacientes por código de diagnóstico (GIN para JSONB)
CREATE INDEX idx_consultations_diagnosis_codes ON consultations
  USING GIN (diagnosis_codes jsonb_path_ops)
  WHERE deleted_at IS NULL;

-- Audit log por entidad (para ver historial de cambios de un registro)
CREATE INDEX idx_audit_entity ON audit_logs(organization_id, entity_type, entity_id, timestamp DESC);
```

### Estrategia para imágenes médicas

Las imágenes NUNCA se almacenan en PostgreSQL. Cloudflare R2 gestiona los archivos binarios. En la tabla `imaging_studies` solo se almacenan metadatos y la clave R2. Esto mantiene la base de datos ligera y dentro del free tier de Neon durante el MVP.

### Tamaño estimado MVP (free tier Neon: 0.5GB)

```
Tabla                   Tamaño/registro   1.000 pacientes   5.000 pacientes
─────────────────────────────────────────────────────────────────────────────
patients                ~500B             ~0.5MB            ~2.5MB
consultations (x10/pac) ~2KB              ~20MB             ~100MB
surgeries (x2/pac)      ~3KB              ~6MB              ~30MB
imaging_studies (meta)  ~1KB              ~5MB              ~25MB
medications (x5/pac)    ~500B             ~2.5MB            ~12.5MB
reports (x3/pac)        ~5KB              ~15MB             ~75MB
audit_logs              ~300B             ~50MB             ~250MB
─────────────────────────────────────────────────────────────────────────────
TOTAL estimado                            ~99MB             ~495MB
```

El límite de 0.5GB se alcanza aproximadamente con 5.000 pacientes. En ese punto (que implica un negocio ya validado), la migración a un plan de pago o a Hetzner es trivial.

---

## 6. Codificación Clínica: CIE-10 y SNOMED

### Estructura de un código diagnóstico en JSONB

```typescript
// packages/contracts/src/clinical-codes.schema.ts

const DiagnosisCodeSchema = z.object({
  system: z.enum(['ICD10', 'SNOMED']),
  code: z.string(),
  description: z.string(),
  type: z.enum(['primary', 'secondary', 'differential']),
  notes: z.string().optional(),
});

const ProcedureCodeSchema = z.object({
  system: z.enum(['ICD10PCS', 'SNOMED', 'CPT']),
  code: z.string(),
  description: z.string(),
  laterality: z.enum(['left', 'right', 'bilateral', 'na']).optional(),
  notes: z.string().optional(),
});

// Ejemplo de diagnosisCodes en una consulta ORL
const example = [
  {
    system: 'ICD10',
    code: 'J34.2',
    description: 'Desviación del tabique nasal',
    type: 'primary',
  },
  {
    system: 'ICD10',
    code: 'J30.4',
    description: 'Rinitis alérgica, no especificada',
    type: 'secondary',
  },
  {
    system: 'SNOMED',
    code: '126660000',
    description: 'Nasal septum deviation (disorder)',
    type: 'primary',
  },
];
```

### Catálogo CIE-10 (paquete `@MediCore/clinical-codes`)

El catálogo CIE-10 español (versión de la OMS adaptada por el MSSSI) se distribuye como paquete interno del monorepo. No se almacena en PostgreSQL — es datos de referencia estáticos. La búsqueda de códigos es una búsqueda client-side sobre un JSON precargado para los capítulos más relevantes en ORL:

```
Capítulos CIE-10 relevantes para ORL:
  H60-H95  — Enfermedades del oído y de la apófisis mastoides
  J00-J06  — Infecciones agudas de las vías respiratorias superiores
  J30-J39  — Otras enfermedades de las vías respiratorias superiores
  J40-J47  — Enfermedades crónicas de las vías respiratorias inferiores (relevante: J44, J45)
  C00-C14  — Tumores malignos de labio, cavidad bucal y faringe
  C30-C32  — Tumores malignos del tracto respiratorio superior
  D10-D36  — Tumores benignos (relevante: D14 — glándulas salivales, nariz, laringe)
  Q16-Q18  — Malformaciones congénitas del oído y cara
```

Los capítulos completos se cargan bajo demanda para búsquedas avanzadas o si el médico los necesita.

### Integración con generación de informes IA

Cuando la IA genera un informe, el modelo Claude recibe como contexto los códigos diagnósticos y de procedimiento ya seleccionados por el médico. El modelo no inventa códigos — solo los usa para estructurar el informe. La validación de que los códigos existen en el catálogo oficial se hace en el backend antes de persistir.

---

## 7. Política de Retención y RGPD

### Base legal del tratamiento

Los datos clínicos se tratan bajo la base jurídica del **Art. 9.2.h RGPD** (tratamiento necesario para la prestación de asistencia sanitaria). Esto permite el tratamiento de datos de categoría especial (datos de salud) sin consentimiento explícito para el tratamiento médico.

El consentimiento **sí es necesario** para: uso en investigación, fotografías clínicas, y tratamiento de datos para fines distintos de la atención directa.

### Períodos de retención

```
Entidad                  Retención mínima legal         Retención en MediCore
────────────────────────────────────────────────────────────────────────────────
Historia clínica         5 años (Ley 41/2002)           10 años desde último acto
                         (algunas CCAA: más)             clínico (margen de seguridad)

Menores de edad          Hasta mayoría de edad           Hasta mayoría de edad
                         + 5 años mínimo                 + 10 años

Imágenes médicas         Igual que historia clínica      10 años
(radiografías, TAC)

Audit logs               No especificado en ley          5 años (ENS nivel ALTO)
                         médica, pero sí en RGPD

Consentimientos RGPD     Mientras activos +              Indefinido (inmutables)
                         período de reclamación

Datos de facturación     4 años (Hacienda)               6 años (margen fiscal)
```

### Implementación del soft delete con retención

```typescript
// El soft delete NO elimina datos — solo los oculta de la interfaz
// La eliminación real es un proceso batch que se ejecuta periódicamente

// apps/api/src/infrastructure/database/retention.service.ts
// Purga física los registros cuyo deletedAt supera el período de retención
// Solo se ejecuta con confirmación explícita del owner del workspace
// Genera un registro de auditoría antes de la purga
```

### Derecho al olvido (Art. 17 RGPD)

El derecho al olvido en datos de salud está **limitado** por la obligación de conservar la historia clínica (Art. 9.2.h RGPD + Ley 41/2002). La implementación correcta es:

- El paciente puede solicitar la eliminación de datos no clínicos (datos de contacto, notas libres no clínicas)
- Los datos de la historia clínica se conservan durante el período legal, pero pueden **anonimizarse** (desvinculación del nombre e identificadores, manteniendo los datos clínicos para auditoría)
- La anonimización es irreversible y genera un registro de auditoría con la fecha y el motivo

### Portabilidad (Art. 20 RGPD)

La función de exportación de paciente genera un JSON estructurado con toda la historia clínica en formato legible y portable. Este JSON sigue la estructura del futuro perfil FHIR (preparación para HL7 FHIR en roadmap v2).

---

## 8. Migraciones y Evolución del Schema

### Estrategia de migraciones

```bash
# Crear una nueva migración tras modificar schema.prisma
npx prisma migrate dev --name "add_surgery_outcome_field"

# Aplicar migraciones en producción (CI/CD)
npx prisma migrate deploy

# Nunca usar en producción:
# npx prisma migrate reset  ← borra todos los datos
# npx prisma db push        ← no genera archivos de migración
```

### Normas para migraciones en producción

- **Siempre hacia adelante:** no se revierten migraciones en producción. Si hay un error, se crea una nueva migración que lo corrige.
- **Cambios no destructivos primero:** al renombrar una columna, se crea la nueva columna, se migran los datos, y se elimina la antigua en una migración posterior (en producción, separadas por al menos un deploy).
- **Índices de forma concurrente:** los índices en tablas grandes se crean con `CREATE INDEX CONCURRENTLY` para no bloquear escrituras.
- **Branching de Neon:** cada PR de la rama `develop` utiliza un branch de base de datos de Neon independiente. Esto permite testear migraciones sin afectar `staging` ni `production`.

### Campos JSONB: evolución sin migración

Los campos JSONB (`physicalExam`, `technique`, `diagnosisCodes`, etc.) evolucionan sin migraciones de base de datos. Los cambios de estructura se gestionan con versioning del schema Zod:

```typescript
// packages/contracts/src/physical-exam.schema.ts

// v1 — MVP
const PhysicalExamSchemaV1 = z.object({
  otoscopy: OtoscopySchema.optional(),
  rhinoscopy: RhinoscopySchema.optional(),
  // ...
});

// v2 — cuando se añade nuevo campo
const PhysicalExamSchemaV2 = PhysicalExamSchemaV1.extend({
  vestibularExam: VestibularExamSchema.optional(), // nuevo en v2
});

// El parser siempre acepta ambas versiones (backwards compatible)
const PhysicalExamSchema = z.union([PhysicalExamSchemaV2, PhysicalExamSchemaV1]);
```

---

## 9. Seed de Datos para Desarrollo y Tests

El seed crea datos realistas para ORL que permiten trabajar con la aplicación desde el primer día y ejecutar los tests de integración.

```typescript
// apps/api/prisma/seed.ts

// Organización de demo
const demoOrg = {
  name: 'Clínica ORL Dr. Martínez',
  slug: 'clinica-orl-martinez',
  type: 'CLINIC',
};

// Médico de demo
const demoPhysician = {
  email: 'physician@demo.MediCore.com',
  name: 'Dr. Carlos Martínez Ruiz',
  role: 'OWNER',
};

// Pacientes de demo (10 pacientes con historias clínicas completas)
// Incluyen: consultas, cirugías, imágenes, medicaciones, escalas e informes
// Los datos son completamente ficticios y sin valor personal real

// Patologías ORL representadas en el seed:
// · Rinosinusitis crónica (J32.9) — con escala SNOT-22
// · Otitis media secretora bilateral (H65.3) — con audiometría
// · Desviación septal + CENS bilateral (J34.2) — con cirugía
// · Vértigo posicional paroxístico benigno (H81.1) — con DHI y VHIT
// · Amígdalas hipertróficas grado III (J35.1) — con cirugía
// · Nódulos de cuerdas vocales (J38.2) — con VHI y laringoscopia
// · Hipoacusia neurosensorial bilateral (H90.3) — con audiometría + ABR
// · Apnea del sueño moderada (G47.3) — con Epworth + STOP-BANG
```

---
