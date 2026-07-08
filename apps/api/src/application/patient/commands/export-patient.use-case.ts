import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import type { IConsultationRepository } from '@/domain/consultation/consultation.repository.interface';
import type { ISurgeryRepository } from '@/domain/surgery/surgery.repository.interface';
import type { IImagingStudyRepository } from '@/domain/imaging/imaging-study.repository.interface';
import type { IMedicationRepository } from '@/domain/medication/medication.repository.interface';
import type { IClinicalScaleRepository } from '@/domain/scale/scale.repository.interface';
import type { Patient } from '@/domain/patient/patient.entity';
import { PatientNotFoundError } from '@/domain/patient/errors/patient-not-found.error';
import { AuditLogService } from '@/infrastructure/audit/audit-log.service';

export interface ExportPatientCommand {
  patientId: string;
  organizationId: string;
  userId: string;
  includeDeleted?: boolean;
  sections?: string[];
}

export interface PatientExport {
  resourceType: 'Bundle';
  type: 'document';
  timestamp: string;
  entry: Array<{
    resource: Record<string, unknown>;
  }>;
}

function shouldInclude(sections: string[] | undefined, section: string): boolean {
  if (!sections || sections.length === 0) return true;
  return sections.includes(section);
}

function formatDate(d: Date | string | undefined | null): string | undefined {
  if (!d) return undefined;
  return d instanceof Date ? d.toISOString().split('T')[0] : d;
}

const EXPORT_PAGE_SIZE = 2000;

export class ExportPatientHandler {
  constructor(
    private readonly patientRepo: IPatientRepository,
    private readonly consultationRepo: IConsultationRepository,
    private readonly surgeryRepo: ISurgeryRepository,
    private readonly imagingRepo: IImagingStudyRepository,
    private readonly medicationRepo: IMedicationRepository,
    private readonly scaleRepo: IClinicalScaleRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  async execute(command: ExportPatientCommand): Promise<PatientExport> {
    const { patientId, organizationId, userId, includeDeleted, sections } = command;

    const patient = await this.patientRepo.findByIdWithAllergies(patientId, organizationId);
    if (!patient) {
      throw new PatientNotFoundError(patientId);
    }

    const entries: Array<{ resource: Record<string, unknown> }> = [];

    // Patient resource
    entries.push({ resource: this.buildPatientResource(patient) });

    // AllergyIntolerance resources
    for (const allergy of patient.allergies) {
      entries.push({ resource: this.buildAllergyResource(allergy, patientId) });
    }

    // Consultations (Encounter)
    if (shouldInclude(sections, 'consultations')) {
      const consultations = await this.consultationRepo.findByPatientId(patientId, organizationId);
      for (const c of consultations) {
        if (!includeDeleted && (c as any).deletedAt) continue;
        entries.push({ resource: this.buildEncounterResource(c) });
      }
    }

    // Surgeries (Procedure)
    if (shouldInclude(sections, 'surgeries')) {
      const surgeryResult = await this.surgeryRepo.listByPatient({
        patientId,
        organizationId,
        page: 1,
        pageSize: EXPORT_PAGE_SIZE,
        sortBy: 'date',
        sortOrder: 'desc',
      });
      for (const s of surgeryResult.items) {
        if (!includeDeleted && (s as any).deletedAt) continue;
        entries.push({ resource: this.buildProcedureResource(s) });
      }
    }

    // Imaging studies (ImagingStudy)
    if (shouldInclude(sections, 'imaging')) {
      const imagingResult = await this.imagingRepo.listByPatient({
        patientId,
        organizationId,
        page: 1,
        pageSize: EXPORT_PAGE_SIZE,
        sortBy: 'date',
        sortOrder: 'desc',
      });
      for (const i of imagingResult.items) {
        if (!includeDeleted && (i as any).deletedAt) continue;
        entries.push({ resource: this.buildImagingStudyResource(i) });
      }
    }

    // Medications (MedicationRequest)
    if (shouldInclude(sections, 'medications')) {
      const medResult = await this.medicationRepo.listByPatient({
        patientId,
        organizationId,
        page: 1,
        pageSize: EXPORT_PAGE_SIZE,
      });
      for (const m of medResult.items) {
        if (!includeDeleted && (m as any).deletedAt) continue;
        entries.push({ resource: this.buildMedicationRequestResource(m) });
      }
    }

    // Clinical scales (Observation)
    if (shouldInclude(sections, 'scales')) {
      const scaleResult = await this.scaleRepo.listByPatient({
        patientId,
        organizationId,
        page: 1,
        pageSize: EXPORT_PAGE_SIZE,
      });
      for (const s of scaleResult.items) {
        if (!includeDeleted && (s as any).deletedAt) continue;
        entries.push({ resource: this.buildObservationResource(s) });
      }
    }

    // Composition
    const composition = this.buildComposition(patient, entries, includeDeleted);
    entries.push({ resource: composition });

    // Audit log
    await this.auditLog.log({
      organizationId,
      userId,
      action: 'EXPORT',
      entityType: 'Patient',
      entityId: patientId,
      changes: {
        format: 'json',
        sections: sections ?? ['all'],
        includeDeleted: includeDeleted ?? false,
      },
    });

    return {
      resourceType: 'Bundle',
      type: 'document',
      timestamp: new Date().toISOString(),
      entry: entries,
    };
  }

  // ── FHIR Resource builders ──────────────────────────

  private buildPatientResource(p: Patient): Record<string, unknown> {
    return {
      resourceType: 'Patient',
      id: p.id,
      identifier: [{ system: 'urn:oid:medicore.nhc', value: p.nhc }],
      name: [{ family: p.lastName, given: [p.firstName] }],
      birthDate: formatDate(p.birthDate),
      gender: this.mapSex(p.sex as string),
      telecom: [
        ...(p.phone ? [{ system: 'phone', value: p.phone }] : []),
        ...(p.email ? [{ system: 'email', value: p.email }] : []),
      ],
      address: p.address ? [{ text: JSON.stringify(p.address) }] : undefined,
      extension: [
        ...(p.bloodType !== 'UNKNOWN' ? [{ url: 'bloodType', valueString: p.bloodType }] : []),
        ...(p.idDocument ? [{ url: 'idDocument', valueString: p.idDocument }] : []),
      ],
    };
  }

  private buildAllergyResource(
    a: { id: string; substance: string; severity: string; status: string },
    patientId: string,
  ): Record<string, unknown> {
    return {
      resourceType: 'AllergyIntolerance',
      id: a.id,
      patient: { reference: `Patient/${patientId}` },
      code: { text: a.substance },
      criticality: a.severity === 'ANAPHYLAXIS' ? 'high' : a.severity === 'SEVERE' ? 'high' : 'low',
      clinicalStatus: { text: a.status.toLowerCase() },
    };
  }

  private buildEncounterResource(c: any): Record<string, unknown> {
    return {
      resourceType: 'Encounter',
      id: c.id,
      subject: { reference: `Patient/${c.patientId}` },
      period: { start: c.date instanceof Date ? c.date.toISOString() : c.date },
      type: [{ text: c.type }],
      participant: [
        {
          individual: { display: c.physicianName ?? c.physicianId },
        },
      ],
      reasonCode: c.chiefComplaint ? [{ text: c.chiefComplaint }] : undefined,
      diagnosis: c.diagnosisCodes?.map((d: any) => ({
        condition: {
          coding: [{ system: d.system, code: d.code, display: d.description }],
        },
      })),
      extension: [
        ...(c.currentIllness ? [{ url: 'currentIllness', valueString: c.currentIllness }] : []),
        ...(c.physicalExam ? [{ url: 'physicalExam', valueString: JSON.stringify(c.physicalExam) }] : []),
        ...(c.assessment ? [{ url: 'assessment', valueString: c.assessment }] : []),
        ...(c.plan ? [{ url: 'plan', valueString: c.plan }] : []),
        ...(c.followUpDate ? [{ url: 'followUpDate', valueDateTime: c.followUpDate instanceof Date ? c.followUpDate.toISOString() : c.followUpDate }] : []),
      ],
    };
  }

  private buildProcedureResource(s: any): Record<string, unknown> {
    return {
      resourceType: 'Procedure',
      id: s.id,
      subject: { reference: `Patient/${s.patientId}` },
      performedDateTime: s.date instanceof Date ? s.date.toISOString() : s.date,
      status: this.mapSurgeryStatus(s.status),
      code: { text: s.procedureType },
      performer: [{ actor: { display: s.physicianId } }],
      extension: [
        ...(s.asa ? [{ url: 'asa', valueString: s.asa }] : []),
        ...(s.anesthesiaType ? [{ url: 'anesthesiaType', valueString: s.anesthesiaType }] : []),
        ...(s.duration != null ? [{ url: 'duration', valueQuantity: { value: s.duration, unit: 'min' } }] : []),
        ...(s.findings ? [{ url: 'findings', valueString: s.findings }] : []),
        ...(s.complications ? [{ url: 'complications', valueString: s.complications }] : []),
        ...(s.outcome ? [{ url: 'outcome', valueString: s.outcome }] : []),
      ],
    };
  }

  private buildImagingStudyResource(i: any): Record<string, unknown> {
    return {
      resourceType: 'ImagingStudy',
      id: i.id,
      subject: { reference: `Patient/${i.patientId}` },
      started: i.date instanceof Date ? i.date.toISOString() : i.date,
      modality: [{ system: 'http://medicore.app/imaging-types', code: i.type }],
      description: i.description ?? undefined,
      extension: [
        ...(i.findings ? [{ url: 'findings', valueString: i.findings }] : []),
      ],
    };
  }

  private buildMedicationRequestResource(m: any): Record<string, unknown> {
    return {
      resourceType: 'MedicationRequest',
      id: m.id,
      subject: { reference: `Patient/${m.patientId}` },
      medicationCodeableConcept: {
        text: m.drugName,
        coding: m.drugCode ? [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: m.drugCode }] : undefined,
      },
      dosageInstruction: [
        {
          text: `${m.dosage}, ${m.frequency}${m.route ? `, ${m.route}` : ''}`,
          route: m.route ? { text: m.route } : undefined,
        },
      ],
      effectivePeriod: {
        start: m.startDate instanceof Date ? m.startDate.toISOString() : m.startDate,
        end: m.endDate ? (m.endDate instanceof Date ? m.endDate.toISOString() : m.endDate) : undefined,
      },
      status: this.mapMedicationStatus(m.status),
      extension: [
        ...(m.activeIngredient ? [{ url: 'activeIngredient', valueString: m.activeIngredient }] : []),
        ...(m.reason ? [{ url: 'reason', valueString: m.reason }] : []),
        ...(m.instructions ? [{ url: 'instructions', valueString: m.instructions }] : []),
      ],
    };
  }

  private buildObservationResource(s: any): Record<string, unknown> {
    return {
      resourceType: 'Observation',
      id: s.id,
      subject: { reference: `Patient/${s.patientId}` },
      effectiveDateTime: s.date instanceof Date ? s.date.toISOString() : s.date,
      code: { text: s.scaleType },
      component: Object.entries(s.scores as Record<string, number>).map(([key, value]) => ({
        code: { text: key },
        valueQuantity: { value },
      })),
      valueQuantity: { value: s.total },
      extension: [
        ...(s.notes ? [{ url: 'notes', valueString: s.notes }] : []),
      ],
    };
  }

  private buildComposition(
    patient: Patient,
    entries: Array<{ resource: Record<string, unknown> }>,
    includeDeleted: boolean | undefined,
  ): Record<string, unknown> {
    const timestamp = new Date().toISOString();
    return {
      resourceType: 'Composition',
      id: `export-${patient.id}-${Date.now()}`,
      status: 'final',
      type: {
        coding: [{ system: 'http://loinc.org', code: '60591-5', display: 'Patient summary Document' }],
      },
      subject: { reference: `Patient/${patient.id}` },
      date: timestamp,
      title: `Historia clínica de ${patient.lastName}, ${patient.firstName}`,
      section: entries
        .filter((e) => e.resource.resourceType !== 'Composition')
        .map((e) => ({
          title: (e.resource.resourceType as string) ?? 'Resource',
          entry: [{ reference: `${e.resource.resourceType}/${e.resource.id}` }],
        })),
      extension: [
        {
          url: 'http://medicore.app/export-metadata',
          extension: [
            { url: 'includeDeleted', valueBoolean: includeDeleted ?? false },
            { url: 'generatedAt', valueDateTime: timestamp },
          ],
        },
      ],
    };
  }

  // ── Mappers ─────────────────────────────────────────

  private mapSex(sex: string): string {
    const map: Record<string, string> = {
      MALE: 'male',
      FEMALE: 'female',
      OTHER: 'other',
    };
    return map[sex] ?? 'unknown';
  }

  private mapSurgeryStatus(status: string): string {
    const map: Record<string, string> = {
      SCHEDULED: 'preparation',
      IN_PROGRESS: 'in-progress',
      COMPLETED: 'completed',
      CANCELLED: 'stopped',
      POSTPONED: 'on-hold',
    };
    return map[status] ?? 'unknown';
  }

  private mapMedicationStatus(status: string): string {
    const map: Record<string, string> = {
      ACTIVE: 'active',
      DISCONTINUED: 'stopped',
      COMPLETED: 'completed',
      SUSPENDED: 'on-hold',
    };
    return map[status] ?? 'unknown';
  }
}
