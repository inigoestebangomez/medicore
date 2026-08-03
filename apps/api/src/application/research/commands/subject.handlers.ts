// apps/api/src/application/research/commands/subject.handlers.ts
// Handlers for StudySubject enrollment + EHR auto-fill (REQ-FB-006, REQ-FB-009).
// Multi-tenant: every read scoped by organizationId.

import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StudySubject } from '@/domain/research/study-subject.entity';
import type { IStudySubjectRepository } from '@/domain/research/ports/study-subject.repository.interface';
import type { IStudyVariableRepository } from '@/domain/research/ports/study-variable.repository.interface';
import type { IResearchStudyRepository, Paginated } from '@/domain/research/ports/research-study.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import { StudyNotFoundError } from '@/domain/research/errors/study-not-found.error';
import type { StudySubjectInput, StudySubjectUpdate } from '@medicore/contracts';
import { validateAutoFillMap } from '@/domain/research/value-objects/variable-value.vo';

// ─────────────────────────────────────────────
// EnrollSubjectHandler — REQ-FB-006
// ─────────────────────────────────────────────

export interface EnrollSubjectCommand {
  organizationId: string;
  studyId: string;
  enrolledBy: string;
  input: StudySubjectInput;
}

@Injectable()
export class EnrollSubjectHandler {
  constructor(
    @Inject('IStudySubjectRepository') private readonly subjectRepo: IStudySubjectRepository,
    @Inject('IStudyVariableRepository') private readonly varRepo: IStudyVariableRepository,
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
  ) {}

  async execute(cmd: EnrollSubjectCommand): Promise<StudySubject> {
    const study = await this.studyRepo.findById(cmd.studyId, cmd.organizationId);
    if (!study) throw new StudyNotFoundError(cmd.studyId);

    // Validate auto-fill map paths (REQ-FB-009 whitelist).
    const af = cmd.input.autoFillMap ?? {};
    const afCheck = validateAutoFillMap(af);
    if (!afCheck.ok) throw new Error(`invalid_autofill_paths: ${afCheck.invalid.join(', ')}`);

    const subject = StudySubject.create({
      id: randomUUID(),
      organizationId: cmd.organizationId,
      studyId: cmd.studyId,
      patientId: cmd.input.patientId ?? null,
      patientNhc: cmd.input.patientNhc,
      enrolledBy: cmd.enrolledBy,
      autoFillMap: af,
    });

    // Validate every provided value against its variable type (REQ-FB-006).
    const variables = await this.varRepo.findByStudy(cmd.studyId, cmd.organizationId);
    const byId = new Map(variables.map((v) => [v.id, v]));
    let toPersist: StudySubject = subject;
    for (const [varId, raw] of Object.entries(cmd.input.values ?? {})) {
      const v = byId.get(varId);
      if (!v) continue; // unknown variable id — ignored (deleted variables)
      const res = v.validateValue(raw);
      if (!res.ok) throw new Error(`invalid_value_${varId}: ${res.error}`);
      const { subject: updated } = toPersist.setValue(v, raw);
      toPersist = updated;
    }
    return this.subjectRepo.create(toPersist);
  }
}

// ─────────────────────────────────────────────
// ListSubjectsHandler — REQ-FB-006
// ─────────────────────────────────────────────

export interface ListSubjectsCommand {
  organizationId: string;
  studyId: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ListSubjectsHandler {
  constructor(
    @Inject('IStudySubjectRepository') private readonly subjectRepo: IStudySubjectRepository,
  ) {}

  async execute(cmd: ListSubjectsCommand): Promise<Paginated<StudySubject>> {
    return this.subjectRepo.findByStudy(cmd.studyId, cmd.organizationId, {
      page: cmd.page,
      pageSize: cmd.pageSize,
    });
  }
}

// ─────────────────────────────────────────────
// UpdateSubjectHandler — REQ-FB-006
// ─────────────────────────────────────────────

export interface UpdateSubjectCommand {
  organizationId: string;
  studyId: string;
  subjectId: string;
  input: StudySubjectUpdate;
}

@Injectable()
export class UpdateSubjectHandler {
  constructor(
    @Inject('IStudySubjectRepository') private readonly subjectRepo: IStudySubjectRepository,
    @Inject('IStudyVariableRepository') private readonly varRepo: IStudyVariableRepository,
  ) {}

  async execute(cmd: UpdateSubjectCommand): Promise<StudySubject> {
    const subject = await this.subjectRepo.findById(cmd.subjectId, cmd.organizationId);
    if (!subject || subject.studyId !== cmd.studyId)
      throw new StudyNotFoundError(cmd.subjectId);

    // Validate incoming values against their variables.
    if (cmd.input.values) {
      const vars = await this.varRepo.findByStudy(cmd.studyId, cmd.organizationId);
      const byId = new Map(vars.map((v) => [v.id, v]));
      for (const [varId, raw] of Object.entries(cmd.input.values)) {
        const v = byId.get(varId);
        if (!v) continue;
        const res = v.validateValue(raw);
        if (!res.ok) throw new Error(`invalid_value_${varId}: ${res.error}`);
      }
    }

    if (cmd.input.autoFillMap !== undefined) {
      const check = validateAutoFillMap(cmd.input.autoFillMap);
      if (!check.ok) throw new Error(`invalid_autofill_paths: ${check.invalid.join(', ')}`);
    }

    // Apply the patch (values already validated above; persist full updated row).
    const merged: StudySubject = subject.update({
      values: cmd.input.values ? { ...subject.values, ...cmd.input.values } : subject.values,
      autoFillMap: cmd.input.autoFillMap ?? subject.autoFillMap,
      patientId: cmd.input.patientId ?? subject.patientId,
      patientNhc: cmd.input.patientNhc ?? subject.patientNhc,
    });
    return this.subjectRepo.update(merged);
  }
}

// ─────────────────────────────────────────────
// PreviewAutoFillHandler — REQ-FB-009 (preload from EHR on patient linking)
// ─────────────────────────────────────────────

export interface PreviewAutoFillCommand {
  organizationId: string;
  studyId: string;
  patientId: string;
  autoFillMap: Record<string, string>;
}

@Injectable()
export class PreviewAutoFillHandler {
  constructor(
    @Inject('IPatientRepository') private readonly patientRepo: IPatientRepository,
    @Inject('IStudyVariableRepository') private readonly varRepo: IStudyVariableRepository,
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
  ) {}

  async execute(cmd: PreviewAutoFillCommand): Promise<{ overrides: Record<string, unknown> }> {
    const study = await this.studyRepo.findById(cmd.studyId, cmd.organizationId);
    if (!study) throw new StudyNotFoundError(cmd.studyId);
    const afCheck = validateAutoFillMap(cmd.autoFillMap);
    if (!afCheck.ok) throw new Error(`invalid_autofill_paths: ${afCheck.invalid.join(', ')}`);

    const patient = await this.patientRepo.findByIdWithAllergies(cmd.patientId, cmd.organizationId);
    if (!patient) throw new Error('patient_not_found');

    const overrides: Record<string, unknown> = {};
    const variables = await this.varRepo.findByStudy(cmd.studyId, cmd.organizationId);
    const byId = new Map(variables.map((v) => [v.id, v]));
    for (const [varId, ehrPath] of Object.entries(cmd.autoFillMap)) {
      const v = byId.get(varId);
      if (!v) continue;
      const ehrValue = resolveEhrField(patient, ehrPath);
      if (ehrValue !== undefined) {
        // Only include when the EHR value validates for the variable.
        const res = v.validateValue(ehrValue);
        if (res.ok) overrides[varId] = ehrValue;
      }
    }
    return { overrides };
  }
}

// ─────────────────────────────────────────────
// UpdateAutoFillMapHandler — REQ-FB-009 (opt-out per field per study)
// ─────────────────────────────────────────────

export interface UpdateAutoFillMapCommand {
  organizationId: string;
  studyId: string;
  subjectId: string;
  autoFillMap: Record<string, string>;
  optOutFields?: string[];
}

@Injectable()
export class UpdateAutoFillMapHandler {
  constructor(
    @Inject('IStudySubjectRepository') private readonly subjectRepo: IStudySubjectRepository,
  ) {}

  async execute(cmd: UpdateAutoFillMapCommand): Promise<StudySubject> {
    const subject = await this.subjectRepo.findById(cmd.subjectId, cmd.organizationId);
    if (!subject || subject.studyId !== cmd.studyId)
      throw new StudyNotFoundError(cmd.subjectId);
    const check = validateAutoFillMap(cmd.autoFillMap);
    if (!check.ok) throw new Error(`invalid_autofill_paths: ${check.invalid.join(', ')}`);
    // Apply per-field opt-outs: remove opted-out paths from the stored map.
    const optOut = new Set(cmd.optOutFields ?? []);
    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(cmd.autoFillMap)) {
      if (!optOut.has(k)) filtered[k] = v;
    }
    return this.subjectRepo.update(subject.update({ autoFillMap: filtered }));
  }
}

/**
 * Resolve an EHR field path against a patient entity. Supported whitelist
 * paths: patient.firstName/lastName/birthDate/sex/nhc/allergies/importedData.
 */
function resolveEhrField(patient: any, path: string): unknown {
  const parts = path.replace(/^patient\./, '').split('.');
  let cur: any = patient;
  for (const p of parts) {
    if (cur == null) return undefined;
    if (p === 'allergies') cur = cur.allergies ?? [];
    else if (p === 'age' && cur.birthDate) {
      cur = computeAge(cur.birthDate);
    } else if (p === 'importedData') cur = cur.importedData ?? {};
    else cur = cur[p];
  }
  return cur;
}

function computeAge(birthDate: Date | string): number {
  const d = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}