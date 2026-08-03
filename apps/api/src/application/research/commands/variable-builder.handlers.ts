// apps/api/src/application/research/commands/variable-builder.handlers.ts
// Command handlers for the V4 variable builder (REQ-FB-001, REQ-FB-002,
// REQ-FB-004, REQ-FB-005). All multi-tenant: every read scoped by organizationId.

import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StudyVariable } from '@/domain/research/study-variable.entity';
import type { IStudyVariableRepository } from '@/domain/research/ports/study-variable.repository.interface';
import type { IVariableTemplateRepository } from '@/domain/research/ports/variable-template.repository.interface';
import type { IResearchStudyRepository } from '@/domain/research/ports/research-study.repository.interface';
import type { StudyVariableInput, StudyVariableUpdate } from '@medicore/contracts';
import { StudyNotFoundError } from '@/domain/research/errors/study-not-found.error';

// ─────────────────────────────────────────────
// CreateVariableHandler — REQ-FB-001
// ─────────────────────────────────────────────

export interface CreateVariableCommand {
  organizationId: string;
  studyId: string;
  createdBy: string;
  input: StudyVariableInput;
}

@Injectable()
export class CreateVariableHandler {
  constructor(
    @Inject('IStudyVariableRepository') private readonly varRepo: IStudyVariableRepository,
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
  ) {}

  async execute(cmd: CreateVariableCommand): Promise<StudyVariable> {
    // Verify the study belongs to the org (tenancy guard).
    const study = await this.studyRepo.findById(cmd.studyId, cmd.organizationId);
    if (!study) throw new StudyNotFoundError(cmd.studyId);

    const position = cmd.input.position ?? 0;
    const variable = StudyVariable.create({
      id: randomUUID(),
      organizationId: cmd.organizationId,
      studyId: cmd.studyId,
      // createdBy is recorded for audit on the study itself; the variable
      // inherits its tenancy from the parent study.
      name: cmd.input.name,
      label: cmd.input.label,
      type: cmd.input.type,
      scope: cmd.input.scope ?? 'CUSTOM',
      unit: cmd.input.unit ?? null,
      required: cmd.input.required ?? false,
      isCore: cmd.input.isCore ?? false,
      position,
      options: (cmd.input as any).options ?? null,
      range: (cmd.input as any).range ?? null,
      parentId: cmd.input.parentId ?? null,
    });
    return this.varRepo.create(variable);
  }
}

// ─────────────────────────────────────────────
// UpdateVariableHandler — REQ-FB-001 (type immutable post-create)
// ─────────────────────────────────────────────

export interface UpdateVariableCommand {
  organizationId: string;
  studyId: string;
  variableId: string;
  input: StudyVariableUpdate;
}

@Injectable()
export class UpdateVariableHandler {
  constructor(
    @Inject('IStudyVariableRepository') private readonly varRepo: IStudyVariableRepository,
  ) {}

  async execute(cmd: UpdateVariableCommand): Promise<StudyVariable> {
    const v = await this.varRepo.findById(cmd.variableId, cmd.organizationId);
    if (!v || v.studyId !== cmd.studyId) throw new StudyNotFoundError(cmd.variableId);
    return this.varRepo.update(
      v.update({
        label: cmd.input.label,
        unit: cmd.input.unit,
        required: cmd.input.required,
        isCore: cmd.input.isCore,
        position: cmd.input.position,
        options: cmd.input.options,
        range: cmd.input.range,
      }),
    );
  }
}

// ─────────────────────────────────────────────
// DeleteVariableHandler — REQ-FB-004 (history preserved in JSONB)
// Deleting a variable definition does NOT touch StudySubject.values; the
// column already carries historical values which are simply excluded from
// analysis going forward.
// ─────────────────────────────────────────────

export interface DeleteVariableCommand {
  organizationId: string;
  variableId: string;
}

@Injectable()
export class DeleteVariableHandler {
  constructor(
    @Inject('IStudyVariableRepository') private readonly varRepo: IStudyVariableRepository,
  ) {}

  async execute(cmd: DeleteVariableCommand): Promise<void> {
    await this.varRepo.delete(cmd.variableId, cmd.organizationId);
  }
}

// ─────────────────────────────────────────────
// ReorderVariablesHandler — REQ-FB-004
// ─────────────────────────────────────────────

export interface ReorderVariablesCommand {
  organizationId: string;
  studyId: string;
  orderedIds: string[];
}

@Injectable()
export class ReorderVariablesHandler {
  constructor(
    @Inject('IStudyVariableRepository') private readonly varRepo: IStudyVariableRepository,
  ) {}

  async execute(cmd: ReorderVariablesCommand): Promise<void> {
    await this.varRepo.reorder(cmd.studyId, cmd.organizationId, cmd.orderedIds);
  }
}

// ─────────────────────────────────────────────
// DecomposeVariableHandler — REQ-FB-005 (composite → N DICHOTOMOUS children)
// ─────────────────────────────────────────────

export interface DecomposeCommand {
  organizationId: string;
  studyId: string;
  parentVariableId: string;
  children: { name: string; label: string }[];
}

@Injectable()
export class DecomposeVariableHandler {
  constructor(
    @Inject('IStudyVariableRepository') private readonly varRepo: IStudyVariableRepository,
  ) {}

  async execute(cmd: DecomposeCommand): Promise<StudyVariable[]> {
    const parent = await this.varRepo.findById(cmd.parentVariableId, cmd.organizationId);
    if (!parent || parent.studyId !== cmd.studyId)
      throw new StudyNotFoundError(cmd.parentVariableId);
    const children = parent.decompose(cmd.children);
    return this.varRepo.createMany(children);
  }
}

// ─────────────────────────────────────────────
// AddVariableFromTemplateHandler — REQ-FB-002 (snapshot copy via link)
// ─────────────────────────────────────────────

export interface AddFromTemplateCommand {
  organizationId: string;
  studyId: string;
  templateId: string;
}

@Injectable()
export class AddVariableFromTemplateHandler {
  constructor(
    @Inject('IVariableTemplateRepository') private readonly templateRepo: IVariableTemplateRepository,
    @Inject('IStudyVariableRepository') private readonly varRepo: IStudyVariableRepository,
    @Inject('IResearchStudyRepository') private readonly studyRepo: IResearchStudyRepository,
  ) {}

  async execute(cmd: AddFromTemplateCommand): Promise<StudyVariable> {
    const study = await this.studyRepo.findById(cmd.studyId, cmd.organizationId);
    if (!study) throw new StudyNotFoundError(cmd.studyId);
    const template = await this.templateRepo.findById(cmd.templateId, cmd.organizationId);
    if (!template) throw new StudyNotFoundError(cmd.templateId);

    const { variable, link } = template.instantiate(cmd.studyId, cmd.organizationId);
    const saved = await this.varRepo.create(variable as unknown as StudyVariable);
    // Persist the immutable snapshot link (future template edits won't mutate it).
    await this.templateRepo.createLink(link);
    return saved;
  }
}