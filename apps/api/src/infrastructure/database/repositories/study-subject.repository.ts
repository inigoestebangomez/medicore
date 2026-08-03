// apps/api/src/infrastructure/database/repositories/study-subject.repository.ts
// Prisma adapter for IStudySubjectRepository (REQ-FB-006, V4).

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StudySubject } from '@/domain/research/study-subject.entity';
import type {
  IStudySubjectRepository,
} from '@/domain/research/ports/study-subject.repository.interface';
import type { Paginated } from '@/domain/research/ports/research-study.repository.interface';

@Injectable()
export class PrismaStudySubjectRepository implements IStudySubjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(subject: StudySubject): Promise<StudySubject> {
    const r = await this.prisma.studySubject.create({ data: this.toCreate(subject) as any });
    return this.toEntity(r);
  }

  async findById(id: string, organizationId: string): Promise<StudySubject | null> {
    const r = await this.prisma.studySubject.findFirst({ where: { id, organizationId } });
    return r ? this.toEntity(r) : null;
  }

  async findByStudy(studyId: string, organizationId: string, opts: { page?: number; pageSize?: number } = {}): Promise<Paginated<StudySubject>> {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 50;
    const where = { studyId, organizationId };
    const [records, total] = await Promise.all([
      this.prisma.studySubject.findMany({ where, orderBy: { enrolledAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.studySubject.count({ where }),
    ]);
    return { items: records.map((r) => this.toEntity(r)), total, page, pageSize };
  }

  async update(subject: StudySubject): Promise<StudySubject> {
    const r = await this.prisma.studySubject.update({
      where: { id: subject.id },
      data: this.toUpdate(subject),
    });
    return this.toEntity(r);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.prisma.studySubject.deleteMany({ where: { id, organizationId } });
  }

  private toCreate(s: StudySubject): Record<string, unknown> {
    return {
      id: s.id,
      organizationId: s.organizationId,
      studyId: s.studyId,
      patientId: s.patientId,
      patientNhc: s.patientNhc,
      values: s.values,
      autoFillMap: s.autoFillMap,
      enrolledBy: s.enrolledBy,
    };
  }

  private toUpdate(s: StudySubject): Record<string, unknown> {
    return {
      patientId: s.patientId,
      patientNhc: s.patientNhc,
      values: s.values,
      autoFillMap: s.autoFillMap,
      updatedAt: new Date(),
    };
  }

  private toEntity(r: any): StudySubject {
    return new StudySubject({
      id: r.id,
      organizationId: r.organizationId,
      studyId: r.studyId,
      patientId: r.patientId,
      patientNhc: r.patientNhc,
      values: r.values ?? {},
      autoFillMap: r.autoFillMap ?? {},
      enrolledBy: r.enrolledBy,
      enrolledAt: r.enrolledAt,
      updatedAt: r.updatedAt,
    });
  }
}