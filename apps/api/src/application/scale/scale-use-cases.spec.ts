// apps/api/src/application/scale/scale-use-cases.spec.ts
// 5.6 — Unit tests for clinical-scale use-case handlers with in-memory repos
// SCA-002: server-side total recalculation; SCA-001: per-type score validation

import { describe, it, expect, beforeEach } from '@jest/globals';
import { CreateClinicalScaleUseCase } from './commands/create-clinical-scale.use-case';
import { UpdateClinicalScaleUseCase } from './commands/update-clinical-scale.use-case';
import { SoftDeleteClinicalScaleUseCase } from './commands/soft-delete-clinical-scale.use-case';
import { ListScalesUseCase } from './queries/list-scales.use-case';
import { GetScaleUseCase } from './queries/get-scale.use-case';
import { ClinicalScale } from '@/domain/scale/clinical-scale.entity';
import { InvalidScaleScoresError } from '@/domain/scale/errors/invalid-scale-scores.error';
import { ClinicalScaleNotFoundError } from '@/domain/scale/errors/clinical-scale-not-found.error';
import type {
  IClinicalScaleRepository,
  CreateClinicalScaleInput,
  UpdateClinicalScaleInput,
  ListScalesParams,
} from '@/domain/scale/scale.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';

class InMemoryScaleRepo implements IClinicalScaleRepository {
  private store = new Map<string, ClinicalScale>();
  private counter = 0;

  async create(data: CreateClinicalScaleInput): Promise<ClinicalScale> {
    this.counter++;
    const scale = new ClinicalScale({
      id: `scale-${this.counter}`,
      organizationId: data.organizationId,
      patientId: data.patientId,
      consultationId: data.consultationId ?? null,
      scaleType: data.scaleType,
      date: data.date,
      scores: data.scores,
      total: data.total,
      notes: data.notes ?? null,
      createdBy: data.createdBy,
    });
    this.store.set(scale.id, scale);
    return scale;
  }

  async findById(id: string, _org: string): Promise<ClinicalScale | null> {
    const s = this.store.get(id);
    if (!s || s.deletedAt) return null;
    return s;
  }

  async listByPatient(params: ListScalesParams): Promise<{ items: ClinicalScale[]; total: number }> {
    let items = Array.from(this.store.values()).filter(
      (s) => s.patientId === params.patientId && s.organizationId === params.organizationId && !s.deletedAt,
    );
    if (params.scaleType) items = items.filter((s) => s.scaleType === params.scaleType);
    if (params.from) items = items.filter((s) => s.date >= params.from!);
    if (params.to) items = items.filter((s) => s.date <= params.to!);
    // BR-SCA-003: date descending
    items = items.sort((a, b) => b.date.getTime() - a.date.getTime());
    const total = items.length;
    const start = (params.page - 1) * params.pageSize;
    return { items: items.slice(start, start + params.pageSize), total };
  }

  async update(id: string, _org: string, data: UpdateClinicalScaleInput): Promise<ClinicalScale> {
    const existing = this.store.get(id);
    if (!existing) throw new ClinicalScaleNotFoundError(id);
    const updated = new ClinicalScale({
      ...existing,
      scores: data.scores ?? existing.scores,
      total: data.total ?? existing.total,
      notes: data.notes ?? existing.notes,
      updatedBy: data.updatedBy,
    } as any);
    this.store.set(id, updated);
    return updated;
  }

  async softDelete(id: string, _org: string): Promise<ClinicalScale> {
    const existing = this.store.get(id);
    if (!existing) throw new ClinicalScaleNotFoundError(id);
    const deleted = existing.softDelete();
    this.store.set(id, deleted);
    return deleted;
  }
}

function makePatientRepo(patient: any | null = { id: 'patient-1' }): IPatientRepository {
  return {
    findById: jest.fn().mockResolvedValue(patient),
  } as any;
}

function snot22Scores(value = 2): Record<string, number> {
  const scores: Record<string, number> = {};
  for (let i = 1; i <= 22; i++) scores[`item_${i}`] = value;
  return scores;
}

describe('Clinical scale use-case handlers (5.6)', () => {
  let repo: InMemoryScaleRepo;
  const orgId = 'org-1';
  const patientId = 'patient-1';
  const userId = 'physician-1';

  beforeEach(() => {
    repo = new InMemoryScaleRepo();
  });

  // ── CreateClinicalScaleUseCase ──
  describe('CreateClinicalScaleUseCase (SCA-001 + SCA-002)', () => {
    it('creates predefined scale with server-recalculated total (ignoring client total)', async () => {
      const useCase = new CreateClinicalScaleUseCase(repo, makePatientRepo());
      const result = await useCase.execute({
        organizationId: orgId,
        patientId,
        scaleType: 'SNOT_22',
        date: new Date('2024-03-15'),
        scores: snot22Scores(2), // 22 * 2 = 44
        createdBy: userId,
      });

      expect(result.total).toBe(44);
      expect(result.scaleType).toBe('SNOT_22');
    });

    it('rejects invalid scores for predefined scale (422 INVALID_SCALE_SCORES)', async () => {
      const useCase = new CreateClinicalScaleUseCase(repo, makePatientRepo());
      await expect(
        useCase.execute({
          organizationId: orgId,
          patientId,
          scaleType: 'SNOT_22',
          date: new Date('2024-03-15'),
          scores: snot22Scores(99), // 99 out of 0–5 range → invalid
          createdBy: userId,
        }),
      ).rejects.toThrow(InvalidScaleScoresError);
    });

    it('rejects wrong item count for SNOT_22', async () => {
      const useCase = new CreateClinicalScaleUseCase(repo, makePatientRepo());
      const partial = { item_1: 1, item_2: 2 } as Record<string, number>; // only 2, not 22
      await expect(
        useCase.execute({
          organizationId: orgId,
          patientId,
          scaleType: 'SNOT_22',
          date: new Date(),
          scores: partial,
          createdBy: userId,
        }),
      ).rejects.toThrow(InvalidScaleScoresError);
    });

    it('accepts CUSTOM scale with ≥1 key and sums total', async () => {
      const useCase = new CreateClinicalScaleUseCase(repo, makePatientRepo());
      const result = await useCase.execute({
        organizationId: orgId,
        patientId,
        scaleType: 'CUSTOM',
        date: new Date(),
        scores: { pain: 7, sleep: 3 },
        createdBy: userId,
      });
      expect(result.total).toBe(10);
    });

    it('rejects CUSTOM with empty scores {}', async () => {
      const useCase = new CreateClinicalScaleUseCase(repo, makePatientRepo());
      await expect(
        useCase.execute({
          organizationId: orgId,
          patientId,
          scaleType: 'CUSTOM',
          date: new Date(),
          scores: {},
          createdBy: userId,
        }),
      ).rejects.toThrow(InvalidScaleScoresError);
    });
  });

  // ── UpdateClinicalScaleUseCase (SCA-002 on update) ──
  describe('UpdateClinicalScaleUseCase', () => {
    it('recalculates total on score update', async () => {
      const created = await repo.create({
        organizationId: orgId,
        patientId,
        scaleType: 'SNOT_22',
        date: new Date('2024-03-15'),
        scores: snot22Scores(1), // 22
        total: 22,
        createdBy: userId,
      });

      const useCase = new UpdateClinicalScaleUseCase(repo);
      const result = await useCase.execute({
        id: created.id,
        organizationId: orgId,
        scores: snot22Scores(3), // 66
        userId,
      });

      expect(result.total).toBe(66);
    });

    it('throws InvalidScaleScoresError when updated scores are invalid', async () => {
      const created = await repo.create({
        organizationId: orgId,
        patientId,
        scaleType: 'SNOT_22',
        date: new Date(),
        scores: snot22Scores(1),
        total: 22,
        createdBy: userId,
      });
      const useCase = new UpdateClinicalScaleUseCase(repo);
      await expect(
        useCase.execute({ id: created.id, organizationId: orgId, scores: snot22Scores(99), userId }),
      ).rejects.toThrow(InvalidScaleScoresError);
    });

    it('throws ClinicalScaleNotFoundError for missing scale', async () => {
      const useCase = new UpdateClinicalScaleUseCase(repo);
      await expect(
        useCase.execute({ id: 'missing', organizationId: orgId, scores: snot22Scores(1), userId }),
      ).rejects.toThrow(ClinicalScaleNotFoundError);
    });
  });

  // ── ListScalesUseCase (SCA-003 ordering + filters) ──
  describe('ListScalesUseCase (SCA-003 + SCA-005)', () => {
    it('lists scales of same type ordered date-descending', async () => {
      await repo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date('2024-01-01'), scores: snot22Scores(1), total: 22, createdBy: userId });
      await repo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date('2024-03-15'), scores: snot22Scores(2), total: 44, createdBy: userId });
      await repo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date('2024-02-10'), scores: snot22Scores(1), total: 22, createdBy: userId });
      await repo.create({ organizationId: orgId, patientId, scaleType: 'DHI', date: new Date('2024-03-01'), scores: { item_1: 0 }, total: 0, createdBy: userId });

      const useCase = new ListScalesUseCase(repo);
      const result = await useCase.execute({
        patientId, organizationId: orgId, page: 1, pageSize: 20, scaleType: 'SNOT_22',
      });

      expect(result.total).toBe(3);
      expect(result.items[0].date.toISOString()).toContain('2024-03-15');
      expect(result.items[1].date.toISOString()).toContain('2024-02-10');
      expect(result.items[2].date.toISOString()).toContain('2024-01-01');
    });

    it('filters by date range', async () => {
      await repo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date('2024-01-01'), scores: snot22Scores(1), total: 22, createdBy: userId });
      await repo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date('2024-05-01'), scores: snot22Scores(1), total: 22, createdBy: userId });

      const useCase = new ListScalesUseCase(repo);
      const result = await useCase.execute({
        patientId, organizationId: orgId, page: 1, pageSize: 20,
        from: new Date('2024-03-01'), to: new Date('2024-06-30'),
      });
      expect(result.total).toBe(1);
    });

    it('excludes soft-deleted scales', async () => {
      const s = await repo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date(), scores: snot22Scores(1), total: 22, createdBy: userId });
      await repo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date(), scores: snot22Scores(1), total: 22, createdBy: userId });
      await repo.softDelete(s.id, orgId);

      const useCase = new ListScalesUseCase(repo);
      const result = await useCase.execute({ patientId, organizationId: orgId, page: 1, pageSize: 20 });
      expect(result.total).toBe(1);
    });
  });

  // ── GetScaleUseCase ──
  describe('GetScaleUseCase (SCA-005)', () => {
    it('returns a single scale by id', async () => {
      const created = await repo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date(), scores: snot22Scores(1), total: 22, createdBy: userId });
      const useCase = new GetScaleUseCase(repo);
      const result = await useCase.execute({ id: created.id, organizationId: orgId });
      expect(result.id).toBe(created.id);
    });

    it('throws ClinicalScaleNotFoundError for missing id', async () => {
      const useCase = new GetScaleUseCase(repo);
      await expect(useCase.execute({ id: 'missing', organizationId: orgId })).rejects.toThrow(ClinicalScaleNotFoundError);
    });
  });

  // ── SoftDeleteClinicalScaleUseCase ──
  describe('SoftDeleteClinicalScaleUseCase (SCA-004)', () => {
    it('soft-deletes an existing scale', async () => {
      const created = await repo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date(), scores: snot22Scores(1), total: 22, createdBy: userId });
      const useCase = new SoftDeleteClinicalScaleUseCase(repo);
      const result = await useCase.execute({ id: created.id, organizationId: orgId, userId });
      expect(result.deletedAt).not.toBeNull();
    });

    it('throws ClinicalScaleNotFoundError for missing scale', async () => {
      const useCase = new SoftDeleteClinicalScaleUseCase(repo);
      await expect(useCase.execute({ id: 'missing', organizationId: orgId, userId })).rejects.toThrow(ClinicalScaleNotFoundError);
    });
  });
});