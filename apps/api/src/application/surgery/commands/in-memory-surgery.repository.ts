// apps/api/src/application/surgery/commands/in-memory-surgery.repository.ts
// In-memory implementation of ISurgeryRepository for use in spec tests.

import type { ISurgeryRepository, ListSurgeriesParams, ListOrgSurgeriesParams, ListOrgSurgeriesResult, CreateSurgeryInput, UpdateSurgeryInput } from '@/domain/surgery/surgery.repository.interface';
import type { Surgery } from '@/domain/surgery/surgery.entity';
import type { AsaClassification } from '@medicore/contracts';
import { Surgery as SurgeryEntity } from '@/domain/surgery/surgery.entity';
import { SurgeryNotFoundError } from '@/domain/surgery/errors/surgery-not-found.error';
import { hasImportMaterializedMarker } from '@/domain/import/import-provenance';

export class InMemorySurgeryRepository implements ISurgeryRepository {
  private surgeries: Map<string, SurgeryEntity> = new Map();
  private counter = 0;

  async findById(id: string, _organizationId: string): Promise<Surgery | null> {
    const s = this.surgeries.get(id);
    if (!s || s.deletedAt) return null;
    return s;
  }

  async findByPatientId(id: string, patientId: string, organizationId: string): Promise<Surgery | null> {
    for (const s of this.surgeries.values()) {
      if (s.id === id && s.patientId === patientId && s.organizationId === organizationId && !s.deletedAt) {
        return s;
      }
    }
    return null;
  }

  async listByPatient(params: ListSurgeriesParams): Promise<{ items: Surgery[]; total: number }> {
    let items = Array.from(this.surgeries.values()).filter(
      (s) => s.patientId === params.patientId && s.organizationId === params.organizationId && !s.deletedAt,
    );

    // Status filter
    if (params.status) {
      items = items.filter((s) => s.status === params.status);
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

  async listByOrganization(params: ListOrgSurgeriesParams): Promise<ListOrgSurgeriesResult> {
    let items = Array.from(this.surgeries.values()).filter(
      (s) => s.organizationId === params.organizationId && !s.deletedAt,
    );

    if (params.status) {
      items = items.filter((s) => s.status === params.status);
    }
    if (params.physicianId) {
      items = items.filter((s) => s.physicianId === params.physicianId);
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

    // In-memory tests don't track patient names; return empty map.
    const patientNames = new Map();
    return { items: paged, total, patientNames };
  }

  async create(data: CreateSurgeryInput): Promise<Surgery> {
    this.counter++;
    const id = `surgery-${this.counter}`;
    const surgery = new SurgeryEntity({
      id,
      organizationId: data.organizationId,
      patientId: data.patientId,
      physicianId: data.physicianId,
      date: data.date,
      status: data.status,
      procedureType: data.procedureType,
      procedureCodes: data.procedureCodes ?? null,
      asa: (data.asa as AsaClassification | null | undefined) ?? null,
      anesthesiaType: data.anesthesiaType ?? null,
      preOpNotes: data.preOpNotes ?? null,
      preOpChecklist: data.preOpChecklist ?? null,
      duration: data.duration ?? null,
      technique: data.technique ?? null,
      findings: data.findings ?? null,
      complications: data.complications ?? null,
      postOpNotes: data.postOpNotes ?? null,
      postOpProtocol: data.postOpProtocol ?? null,
      outcome: data.outcome ?? null,
      editReason: null,
      createdBy: data.createdBy,
      auditLog: data.auditLog ?? null,
    });
    this.surgeries.set(id, surgery);
    return surgery;
  }

  async update(id: string, _organizationId: string, data: UpdateSurgeryInput): Promise<Surgery> {
    const existing = this.surgeries.get(id);
    if (!existing) throw new SurgeryNotFoundError(id);

    const updated = new SurgeryEntity({
      ...existing,
      ...Object.fromEntries(
        Object.entries(data).filter(([k, v]) => k !== 'auditLog' && v !== undefined),
      ),
      updatedAt: new Date(),
    } as any);
    this.surgeries.set(id, updated);
    return updated;
  }

  async softDelete(id: string, _organizationId: string): Promise<Surgery> {
    const existing = this.surgeries.get(id);
    if (!existing) throw new SurgeryNotFoundError(id);
    const deleted = existing.softDelete();
    this.surgeries.set(id, deleted);
    return deleted;
  }

  async hasScheduledSurgeries(patientId: string, organizationId: string): Promise<boolean> {
    return Array.from(this.surgeries.values()).some(
      (s) =>
        s.patientId === patientId &&
        s.organizationId === organizationId &&
        !s.deletedAt &&
        (s.status === 'SCHEDULED' || s.status === 'POSTPONED'),
    );
  }

  async findByImportBatchRow(batchId: string, organizationId: string, rowIndex: number): Promise<Surgery | null> {
    return Array.from(this.surgeries.values()).find((s) =>
      s.organizationId === organizationId && !s.deletedAt && hasImportMaterializedMarker(s.auditLog, batchId, rowIndex),
    ) ?? null;
  }

  async removeImportedBatch(batchId: string, organizationId: string): Promise<number> {
    let count = 0;
    for (const [id, surgery] of this.surgeries.entries()) {
      if (surgery.organizationId !== organizationId || surgery.deletedAt) continue;
      if (!hasImportMaterializedMarker(surgery.auditLog, batchId)) continue;
      this.surgeries.set(id, surgery.softDelete());
      count++;
    }
    return count;
  }
}
