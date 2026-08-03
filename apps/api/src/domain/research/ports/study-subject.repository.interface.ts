// apps/api/src/domain/research/ports/study-subject.repository.interface.ts
// Port: IStudySubjectRepository — persistence boundary for StudySubject.
// Multi-tenant: every read scoped by organizationId.

import type { StudySubject } from '../study-subject.entity';
import type { Paginated } from './research-study.repository.interface';

export interface IStudySubjectRepository {
  create(subject: StudySubject): Promise<StudySubject>;
  findById(id: string, organizationId: string): Promise<StudySubject | null>;
  findByStudy(studyId: string, organizationId: string, opts?: { page?: number; pageSize?: number }): Promise<Paginated<StudySubject>>;
  update(subject: StudySubject): Promise<StudySubject>;
  delete(id: string, organizationId: string): Promise<void>;
}

export type { Paginated };