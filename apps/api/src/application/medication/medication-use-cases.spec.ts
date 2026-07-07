// apps/api/src/application/medication/medication-use-cases.spec.ts
// 5.6 — Unit tests for medication use-case handlers with in-memory repos

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ListMedicationsUseCase } from './queries/list-medications.use-case';
import { GetMedicationUseCase } from './queries/get-medication.use-case';
import { DiscontinueMedicationUseCase } from './commands/discontinue-medication.use-case';
import { SoftDeleteMedicationUseCase } from './commands/soft-delete-medication.use-case';
import { Medication } from '@/domain/medication/medication.entity';
import { MedicationNotFoundError } from '@/domain/medication/errors/medication-not-found.error';
import { MissingDiscontinuationReasonError } from '@/domain/medication/errors/missing-discontinuation-reason.error';
import { InvalidMedicationTransitionError } from '@/domain/medication/errors/invalid-medication-transition.error';
import type { IMedicationRepository, CreateMedicationInput, UpdateMedicationInput, ListMedicationsParams } from '@/domain/medication/medication.repository.interface';

class InMemoryMedicationRepo implements IMedicationRepository {
  private store = new Map<string, Medication>();
  private counter = 0;

  async create(data: CreateMedicationInput): Promise<Medication> {
    this.counter++;
    const med = new Medication({
      id: `med-${this.counter}`,
      organizationId: data.organizationId,
      patientId: data.patientId,
      physicianId: data.physicianId,
      drugName: data.drugName,
      dosage: data.dosage,
      frequency: data.frequency,
      startDate: data.startDate,
      status: data.status ?? 'ACTIVE',
      activeIngredient: data.activeIngredient ?? null,
      drugCode: data.drugCode ?? null,
      createdBy: data.createdBy,
    });
    this.store.set(med.id, med);
    return med;
  }

  async findById(id: string, _orgId: string): Promise<Medication | null> {
    const m = this.store.get(id);
    if (!m || m.deletedAt) return null;
    return m;
  }

  async listByPatient(params: ListMedicationsParams): Promise<{ items: Medication[]; total: number }> {
    let items = Array.from(this.store.values()).filter(
      (m) => m.patientId === params.patientId && m.organizationId === params.organizationId && !m.deletedAt,
    );
    if (params.status) items = items.filter((m) => m.status === params.status);
    const total = items.length;
    const start = (params.page - 1) * params.pageSize;
    return { items: items.slice(start, start + params.pageSize), total };
  }

  async update(id: string, _orgId: string, data: UpdateMedicationInput): Promise<Medication> {
    const existing = this.store.get(id);
    if (!existing) throw new MedicationNotFoundError(id);
    const updated = new Medication({
      ...existing,
      status: data.status ?? existing.status,
      discontinuationReason: data.discontinuationReason ?? existing.discontinuationReason,
      updatedBy: data.updatedBy,
    } as any);
    this.store.set(id, updated);
    return updated;
  }

  async softDelete(id: string, _orgId: string): Promise<Medication> {
    const existing = this.store.get(id);
    if (!existing) throw new MedicationNotFoundError(id);
    const deleted = existing.softDelete();
    this.store.set(id, deleted);
    return deleted;
  }

  async findActiveByActiveIngredient(_p: string, _o: string, _ai: string): Promise<Medication[]> {
    return Array.from(this.store.values()).filter((m) => m.status === 'ACTIVE' && m.activeIngredient === _ai);
  }
}

describe('Medication use-case handlers (5.6)', () => {
  let repo: InMemoryMedicationRepo;
  const orgId = 'org-1';
  const patientId = 'patient-1';
  const userId = 'physician-1';

  beforeEach(() => {
    repo = new InMemoryMedicationRepo();
  });

  async function seedMedication(status: any = 'ACTIVE', activeIngredient = null): Promise<Medication> {
    return repo.create({
      organizationId: orgId,
      patientId,
      physicianId: userId,
      drugName: 'Test Drug',
      activeIngredient,
      dosage: '100mg',
      frequency: 'once daily',
      startDate: new Date('2024-01-01'),
      status,
      createdBy: userId,
    });
  }

  // ── ListMedicationsUseCase ──
  describe('ListMedicationsUseCase (MED-006)', () => {
    it('lists all medications for patient when no status filter', async () => {
      await seedMedication('ACTIVE');
      await seedMedication('DISCONTINUED');
      await seedMedication('COMPLETED');

      const useCase = new ListMedicationsUseCase(repo);
      const result = await useCase.execute({ patientId, organizationId: orgId, page: 1, pageSize: 20 });

      expect(result.total).toBe(3);
    });

    it('filters by status=ACTIVE', async () => {
      await seedMedication('ACTIVE');
      await seedMedication('DISCONTINUED');
      await seedMedication('ACTIVE');

      const useCase = new ListMedicationsUseCase(repo);
      const result = await useCase.execute({ patientId, organizationId: orgId, page: 1, pageSize: 20, status: 'ACTIVE' });

      expect(result.total).toBe(2);
      expect(result.items.every((m) => m.status === 'ACTIVE')).toBe(true);
    });

    it('excludes soft-deleted medications', async () => {
      const m = await seedMedication('ACTIVE');
      await seedMedication('ACTIVE');
      await repo.softDelete(m.id, orgId);

      const useCase = new ListMedicationsUseCase(repo);
      const result = await useCase.execute({ patientId, organizationId: orgId, page: 1, pageSize: 20 });

      expect(result.total).toBe(1);
    });
  });

  // ── GetMedicationUseCase ──
  describe('GetMedicationUseCase (MED-006)', () => {
    it('returns a single medication by id', async () => {
      const created = await seedMedication();
      const useCase = new GetMedicationUseCase(repo);
      const result = await useCase.execute({ id: created.id, organizationId: orgId });
      expect(result.id).toBe(created.id);
    });

    it('throws MedicationNotFoundError for missing id', async () => {
      const useCase = new GetMedicationUseCase(repo);
      await expect(useCase.execute({ id: 'nope', organizationId: orgId })).rejects.toThrow(MedicationNotFoundError);
    });
  });

  // ── DiscontinueMedicationUseCase (BR-MED-001 + BR-MED-003) ──
  describe('DiscontinueMedicationUseCase (MED-001 + MED-004)', () => {
    it('discontinues ACTIVE prescription with valid reason', async () => {
      const created = await seedMedication('ACTIVE');
      const useCase = new DiscontinueMedicationUseCase(repo);
      const result = await useCase.execute({
        id: created.id,
        organizationId: orgId,
        discontinuationReason: 'Adverse reaction: nausea',
        userId,
      });

      expect(result.status).toBe('DISCONTINUED');
      expect(result.discontinuationReason).toBe('Adverse reaction: nausea');
      expect(result.updatedBy).toBe(userId);
    });

    it('throws MissingDiscontinuationReasonError when reason missing (422 scenario)', async () => {
      const created = await seedMedication('ACTIVE');
      const useCase = new DiscontinueMedicationUseCase(repo);
      await expect(
        useCase.execute({ id: created.id, organizationId: orgId, discontinuationReason: '', userId }),
      ).rejects.toThrow(MissingDiscontinuationReasonError);
    });

    it('throws InvalidMedicationTransitionError when discontinuing COMPLETED prescription', async () => {
      const created = await seedMedication('COMPLETED');
      const useCase = new DiscontinueMedicationUseCase(repo);
      await expect(
        useCase.execute({ id: created.id, organizationId: orgId, discontinuationReason: 'test', userId }),
      ).rejects.toThrow(InvalidMedicationTransitionError);
    });

    it('throws MedicationNotFoundError for missing prescription', async () => {
      const useCase = new DiscontinueMedicationUseCase(repo);
      await expect(
        useCase.execute({ id: 'missing', organizationId: orgId, discontinuationReason: 'x', userId }),
      ).rejects.toThrow(MedicationNotFoundError);
    });
  });

  // ── SoftDeleteMedicationUseCase ──
  describe('SoftDeleteMedicationUseCase', () => {
    it('soft-deletes an existing prescription', async () => {
      const created = await seedMedication();
      const useCase = new SoftDeleteMedicationUseCase(repo);
      const result = await useCase.execute({ id: created.id, organizationId: orgId, userId });
      expect(result.deletedAt).not.toBeNull();
    });

    it('throws MedicationNotFoundError for missing prescription', async () => {
      const useCase = new SoftDeleteMedicationUseCase(repo);
      await expect(useCase.execute({ id: 'missing', organizationId: orgId, userId })).rejects.toThrow(MedicationNotFoundError);
    });
  });
});