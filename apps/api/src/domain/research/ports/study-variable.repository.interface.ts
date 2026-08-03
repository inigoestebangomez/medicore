// apps/api/src/domain/research/ports/study-variable.repository.interface.ts
// Port: IStudyVariableRepository — persistence boundary for StudyVariable.
// Multi-tenant: every read scoped by organizationId.

import type { StudyVariable } from '../study-variable.entity';
import type { Paginated } from './research-study.repository.interface';

export interface IStudyVariableRepository {
  create(variable: StudyVariable): Promise<StudyVariable>;
  createMany(variables: StudyVariable[]): Promise<StudyVariable[]>;
  findById(id: string, organizationId: string): Promise<StudyVariable | null>;
  findByStudy(studyId: string, organizationId: string): Promise<StudyVariable[]>;
  update(variable: StudyVariable): Promise<StudyVariable>;
  /** Soft behaviour: data stays in JSONB history (REQ-FB-004). */
  delete(id: string, organizationId: string): Promise<void>;
  reorder(studyId: string, organizationId: string, orderedIds: string[]): Promise<void>;
}

export type { Paginated };