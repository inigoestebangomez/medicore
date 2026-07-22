// apps/api/src/infrastructure/database/repositories/in-memory-patient.repository.ts
// In-memory implementation of IPatientRepository for unit tests

import type { IPatientRepository, FindAllParams, SearchParams, CreatePatientInput, UpdatePatientInput, EnrichPatientInput } from '@/domain/patient/patient.repository.interface';
import type { Patient } from '@/domain/patient/patient.entity';
import { Patient as PatientEntity } from '@/domain/patient/patient.entity';
import { NHC } from '@/domain/patient/value-objects/nhc.vo';

export class InMemoryPatientRepository implements IPatientRepository {
  private patients: Map<string, PatientEntity> = new Map();
  private nhcCounters: Map<string, number> = new Map(); // orgId -> next sequence

  async findById(id: string, organizationId: string): Promise<Patient | null> {
    const patient = this.patients.get(id);
    if (!patient || patient.organizationId !== organizationId || patient.deletedAt) {
      return null;
    }
    return patient;
  }

  async findByIdWithAllergies(id: string, organizationId: string): Promise<Patient | null> {
    return this.findById(id, organizationId);
  }

  async findAll(params: FindAllParams): Promise<{ items: Patient[]; total: number }> {
    let items = Array.from(this.patients.values())
      .filter((p) => p.organizationId === params.organizationId && !p.deletedAt);

    // Sort
    const sortKey = params.sortBy === 'createdAt' ? 'createdAt' : params.sortBy;
    items.sort((a, b) => {
      const aVal = a[sortKey as keyof PatientEntity];
      const bVal = b[sortKey as keyof PatientEntity];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return params.sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (aVal instanceof Date && bVal instanceof Date) {
        return params.sortOrder === 'asc' ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime();
      }
      return 0;
    });

    const total = items.length;
    const start = (params.page - 1) * params.pageSize;
    items = items.slice(start, start + params.pageSize);

    return { items, total };
  }

  async search(params: SearchParams): Promise<{ items: Patient[]; total: number }> {
    const query = params.query.toLowerCase();
    let items = Array.from(this.patients.values())
      .filter(
        (p) =>
          p.organizationId === params.organizationId &&
          !p.deletedAt &&
          (p.lastName.toLowerCase().includes(query) ||
            p.firstName.toLowerCase().includes(query) ||
            p.nhc.toLowerCase().includes(query) ||
            (p.idDocument && p.idDocument.toLowerCase().includes(query))),
      );

    const sortKey = params.sortBy === 'createdAt' ? 'createdAt' : params.sortBy;
    items.sort((a, b) => {
      const aVal = a[sortKey as keyof PatientEntity];
      const bVal = b[sortKey as keyof PatientEntity];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return params.sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (aVal instanceof Date && bVal instanceof Date) {
        return params.sortOrder === 'asc' ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime();
      }
      return 0;
    });

    const total = items.length;
    const start = (params.page - 1) * params.pageSize;
    items = items.slice(start, start + params.pageSize);

    return { items, total };
  }

  async findDuplicates(organizationId: string, lastName: string, birthDate: Date): Promise<Patient[]> {
    return Array.from(this.patients.values()).filter(
      (p) =>
        p.organizationId === organizationId &&
        !p.deletedAt &&
        p.lastName.toLowerCase() === lastName.toLowerCase() &&
        // SDD import-data-quality: a candidate with a null birthDate cannot
        // match by birthDate (unknown DOB). Compare only when both are dates.
        p.birthDate !== null &&
        birthDate !== null &&
        p.birthDate.toDateString() === birthDate.toDateString(),
    );
  }

  async create(data: CreatePatientInput): Promise<Patient> {
    const id = `patient-${this.patients.size + 1}`;
    const patient = new PatientEntity({
      id,
      organizationId: data.organizationId,
      nhc: data.nhc,
      firstName: data.firstName,
      lastName: data.lastName,
      birthDate: data.birthDate,
      sex: data.sex as any,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      emergencyContact: data.emergencyContact ?? null,
      idDocument: data.idDocument ?? null,
      idDocType: (data.idDocType as any) ?? 'DNI',
      bloodType: (data.bloodType as any) ?? 'UNKNOWN',
      notes: data.notes ?? null,
      createdBy: data.createdBy,
      allergies: [],
    });
    this.patients.set(id, patient);
    return patient;
  }

  async update(id: string, organizationId: string, data: UpdatePatientInput): Promise<Patient> {
    const existing = this.patients.get(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new Error('Patient not found');
    }
    const updated = new PatientEntity({
      ...existing,
      ...Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined)),
      updatedAt: new Date(),
    });
    this.patients.set(id, updated);
    return updated;
  }

  // Phase 11 — import matching + enrichment
  async findByNhc(nhc: string, organizationId: string): Promise<Patient | null> {
    const p = Array.from(this.patients.values()).find(
      (x) => x.organizationId === organizationId && !x.deletedAt && x.nhc === nhc,
    );
    return p ?? null;
  }

  async searchByNameFuzzy(organizationId: string, lastName: string, firstName?: string): Promise<Patient[]> {
    const qLast = lastName.toLowerCase();
    const qFirst = firstName?.toLowerCase();
    return Array.from(this.patients.values()).filter(
      (p) =>
        p.organizationId === organizationId &&
        !p.deletedAt &&
        (p.lastName.toLowerCase().includes(qLast) ||
          (qFirst ? p.firstName.toLowerCase().includes(qFirst) : false)),
    );
  }

  async enrich(id: string, organizationId: string, data: EnrichPatientInput, updatedBy: string): Promise<Patient> {
    const existing = this.patients.get(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new Error('Patient not found');
    }
    // BR-IMP-003: only set standard fields when currently empty.
    const props: any = {
      ...existing,
      importedData: data.importedData ?? existing.importedData,
      importBatchId: data.importBatchId ?? existing.importBatchId,
      importSource: data.importSource ?? existing.importSource,
      updatedBy,
      updatedAt: new Date(),
    };
    if (data.birthDate && !existing.birthDate) props.birthDate = data.birthDate;
    if (data.sex && !existing.sex) props.sex = data.sex as any;
    const merged = new PatientEntity(props);
    this.patients.set(id, merged);
    return merged;
  }

  async removeImportedBatch(batchId: string, organizationId: string): Promise<number> {
    let count = 0;
    for (const [id, p] of this.patients.entries()) {
      if (p.organizationId !== organizationId || p.importBatchId !== batchId) continue;
      const imported = (p.importedData as Record<string, unknown> | null) ?? {};
      if (batchId in imported) delete imported[batchId];
      const reverted = new PatientEntity({
        ...p,
        importedData: imported,
        importBatchId: null,
        updatedAt: new Date(),
      });
      this.patients.set(id, reverted);
      count++;
    }
    return count;
  }

  async softDelete(id: string, organizationId: string): Promise<Patient> {
    const existing = this.patients.get(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new Error('Patient not found');
    }
    const deleted = existing.softDelete();
    this.patients.set(id, deleted);
    return deleted;
  }

  async getNextNhcSequence(organizationId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const key = `${organizationId}-${currentYear}`;
    const current = this.nhcCounters.get(key) ?? 0;
    const next = current + 1;
    this.nhcCounters.set(key, next);
    return NHC.generate(currentYear, next).value;
  }

  async hasScheduledSurgeries(_patientId: string, _organizationId: string): Promise<boolean> {
    // In-memory implementation: no surgeries table, always false
    return false;
  }

  async countByOrg(organizationId: string): Promise<number> {
    return Array.from(this.patients.values()).filter(
      (p) => p.organizationId === organizationId && !p.deletedAt,
    ).length;
  }
}