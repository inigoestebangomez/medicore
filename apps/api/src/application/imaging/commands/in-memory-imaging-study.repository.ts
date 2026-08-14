// apps/api/src/application/imaging/commands/in-memory-imaging-study.repository.ts
// In-memory implementation of IImagingStudyRepository for use in spec tests.

import type { IImagingStudyRepository, ListImagingStudiesParams, ListOrgImagingStudiesParams, ListOrgImagingStudiesResult, CreateImagingStudyInput, UpdateImagingStudyInput } from '@/domain/imaging/imaging-study.repository.interface';
import type { FileMetadataEntry } from '@/domain/imaging/imaging-study.entity';
import type { ImagingStudy } from '@/domain/imaging/imaging-study.entity';
import { ImagingStudy as ImagingStudyEntity } from '@/domain/imaging/imaging-study.entity';
import { ImagingStudyNotFoundError } from '@/domain/imaging/errors/imaging-study-not-found.error';

export class InMemoryImagingStudyRepository implements IImagingStudyRepository {
  private studies: Map<string, ImagingStudyEntity> = new Map();
  private counter = 0;

  async findById(id: string, _organizationId: string): Promise<ImagingStudy | null> {
    const s = this.studies.get(id);
    if (!s || s.deletedAt) return null;
    return s;
  }

  async findByPatientId(id: string, patientId: string, organizationId: string): Promise<ImagingStudy | null> {
    for (const s of this.studies.values()) {
      if (s.id === id && s.patientId === patientId && s.organizationId === organizationId && !s.deletedAt) {
        return s;
      }
    }
    return null;
  }

  async listByPatient(params: ListImagingStudiesParams): Promise<{ items: ImagingStudy[]; total: number }> {
    let items = Array.from(this.studies.values()).filter(
      (s) => s.patientId === params.patientId && s.organizationId === params.organizationId && !s.deletedAt,
    );

    // Type filter
    if (params.type) {
      items = items.filter((s) => s.type === params.type);
    }

    // Date range filter
    if (params.from) {
      items = items.filter((s) => s.date >= params.from!);
    }
    if (params.to) {
      items = items.filter((s) => s.date <= params.to!);
    }

    const total = items.length;

    // Sort
    items.sort((a, b) => {
      const aVal = a[params.sortBy];
      const bVal = b[params.sortBy];
      if (aVal instanceof Date && bVal instanceof Date) {
        return params.sortOrder === 'asc' ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime();
      }
      return 0;
    });

    // Paginate
    const start = (params.page - 1) * params.pageSize;
    items = items.slice(start, start + params.pageSize);

    return { items, total };
  }

  async listByOrganization(params: ListOrgImagingStudiesParams): Promise<ListOrgImagingStudiesResult> {
    let items = Array.from(this.studies.values()).filter(
      (s) => s.organizationId === params.organizationId && !s.deletedAt,
    );

    if (params.type) {
      items = items.filter((s) => s.type === params.type);
    }
    if (params.from) {
      items = items.filter((s) => s.date >= params.from!);
    }
    if (params.to) {
      items = items.filter((s) => s.date <= params.to!);
    }

    const total = items.length;

    items.sort((a, b) => {
      const aVal = a[params.sortBy];
      const bVal = b[params.sortBy];
      if (aVal instanceof Date && bVal instanceof Date) {
        return params.sortOrder === 'asc' ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime();
      }
      return 0;
    });

    const start = (params.page - 1) * params.pageSize;
    const paged = items.slice(start, start + params.pageSize);

    const patientNames = new Map();
    return { items: paged, total, patientNames };
  }

  async create(data: CreateImagingStudyInput): Promise<ImagingStudy> {
    this.counter++;
    const id = `imaging-${this.counter}`;
    const study = new ImagingStudyEntity({
      id,
      organizationId: data.organizationId,
      patientId: data.patientId,
      surgeryId: data.surgeryId ?? null,
      consultationId: data.consultationId ?? null,
      type: data.type,
      date: data.date,
      description: data.description ?? null,
      findings: data.findings ?? null,
      labels: data.labels ?? null,
      files: data.files ?? [],
      createdBy: data.createdBy,
    });
    this.studies.set(id, study);
    return study;
  }

  async update(id: string, _organizationId: string, data: UpdateImagingStudyInput): Promise<ImagingStudy> {
    const existing = this.studies.get(id);
    if (!existing) throw new ImagingStudyNotFoundError(id);

    const updated = new ImagingStudyEntity({
      ...existing,
      ...Object.fromEntries(
        Object.entries(data).filter(([_k, v]) => v !== undefined),
      ),
      updatedAt: new Date(),
    } as any);
    this.studies.set(id, updated);
    return updated;
  }

  async appendFiles(id: string, _organizationId: string, files: FileMetadataEntry[]): Promise<ImagingStudy> {
    const existing = this.studies.get(id);
    if (!existing) throw new ImagingStudyNotFoundError(id);

    const updated = existing.addFileMetadata(files);
    this.studies.set(id, updated);
    return updated;
  }

  async softDelete(id: string, _organizationId: string): Promise<ImagingStudy> {
    const existing = this.studies.get(id);
    if (!existing) throw new ImagingStudyNotFoundError(id);
    const deleted = existing.softDelete();
    this.studies.set(id, deleted);
    return deleted;
  }
}