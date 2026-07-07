// apps/api/src/api/scales/scales.controller.spec.ts
// 5.9 — API tests: ScalesController (POST create, GET list, PATCH update, DELETE soft-delete)

import { ScalesController } from './scales.controller';
import type {
  IClinicalScaleRepository,
  CreateClinicalScaleInput,
  UpdateClinicalScaleInput,
  ListScalesParams,
} from '@/domain/scale/scale.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import { ClinicalScale } from '@/domain/scale/clinical-scale.entity';
import type { JwtPayload } from '@medicore/contracts';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

// ─────────────────────────────────────────────
// In-memory ClinicalScale repository
// ─────────────────────────────────────────────
class InMemoryScaleRepository implements IClinicalScaleRepository {
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
    if (!existing) throw new Error('Not found');
    const updated = new ClinicalScale({
      ...existing,
      scores: data.scores ?? existing.scores,
      total: data.total ?? existing.total,
      notes: data.notes ?? existing.notes,
      updatedBy: data.updatedBy,
      updatedAt: new Date(),
    } as any);
    this.store.set(id, updated);
    return updated;
  }

  async softDelete(id: string, _org: string): Promise<ClinicalScale> {
    const existing = this.store.get(id);
    if (!existing) throw new Error('Not found');
    const deleted = existing.softDelete();
    this.store.set(id, deleted);
    return deleted;
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function makePatientRepo(): IPatientRepository {
  return {
    findById: jest.fn().mockResolvedValue({ id: 'patient-1', deletedAt: null }),
  } as any;
}

function snot22Scores(value = 2): Record<string, number> {
  const scores: Record<string, number> = {};
  for (let i = 1; i <= 22; i++) scores[`item_${i}`] = value;
  return scores;
}

describe('ScalesController', () => {
  let controller: ScalesController;
  let scaleRepo: InMemoryScaleRepository;
  let patientRepo: IPatientRepository;

  const orgId = 'org-1';
  const patientId = 'patient-1';
  const userId = 'physician-1';

  const physicianUser: JwtPayload = {
    sub: userId,
    email: 'physician@test.com',
    name: 'Dr. Test',
    organizationId: orgId,
    role: 'PHYSICIAN',
    iat: 1718000000,
    exp: 1718600000,
  };

  beforeEach(() => {
    scaleRepo = new InMemoryScaleRepository();
    patientRepo = makePatientRepo();
    controller = new ScalesController(scaleRepo as any, patientRepo);
  });

  describe('POST /patients/:patientId/scales', () => {
    it('should create a scale with server-calculated total (SNOT-22 = 44)', async () => {
      const body = {
        scaleType: 'SNOT_22',
        date: '2024-03-15T00:00:00.000Z',
        scores: snot22Scores(2), // 22 * 2 = 44
      };

      const result = await controller.create(patientId, body, physicianUser);

      expect(result.scaleType).toBe('SNOT_22');
      expect(result.total).toBe(44);
      expect(result.scores).toEqual(snot22Scores(2));
    });

    it('should create a CUSTOM scale summing provided scores', async () => {
      const body = {
        scaleType: 'CUSTOM',
        scores: { pain: 7, sleep: 3 }, // total = 10
      };

      const result = await controller.create(patientId, body, physicianUser);

      expect(result.total).toBe(10);
    });

    it('should default date to now when omitted', async () => {
      const before = new Date();
      const body = {
        scaleType: 'CUSTOM',
        scores: { metric: 1 },
      };

      const result = await controller.create(patientId, body, physicianUser);
      const after = new Date();

      expect(result.date).toBeDefined();
      const resultDate = new Date(result.date);
      expect(resultDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(resultDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should throw UnprocessableEntityException for invalid scores (wrong item count)', async () => {
      const body = {
        scaleType: 'SNOT_22',
        scores: { item_1: 1, item_2: 2 }, // only 2 items, not 22
      };

      await expect(
        controller.create(patientId, body, physicianUser),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException when patient not found', async () => {
      (patientRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      const body = { scaleType: 'CUSTOM', scores: { metric: 1 } };

      await expect(
        controller.create(patientId, body, physicianUser),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('GET /patients/:patientId/scales', () => {
    it('should return a paginated list ordered by date desc', async () => {
      await scaleRepo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date('2024-01-01'), scores: snot22Scores(1), total: 22, createdBy: userId });
      await scaleRepo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date('2024-03-15'), scores: snot22Scores(2), total: 44, createdBy: userId });
      await scaleRepo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date('2024-02-10'), scores: snot22Scores(1), total: 22, createdBy: userId });

      const result = await controller.list(patientId, {}, physicianUser);

      expect(result.total).toBe(3);
      expect(result.items[0].date).toContain('2024-03-15');
      expect(result.items[1].date).toContain('2024-02-10');
      expect(result.items[2].date).toContain('2024-01-01');
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should filter by scaleType', async () => {
      await scaleRepo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date('2024-01-01'), scores: snot22Scores(1), total: 22, createdBy: userId });
      await scaleRepo.create({ organizationId: orgId, patientId, scaleType: 'DHI', date: new Date('2024-01-02'), scores: { item_1: 0 }, total: 0, createdBy: userId });
      await scaleRepo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date('2024-01-03'), scores: snot22Scores(1), total: 22, createdBy: userId });

      const result = await controller.list(patientId, { scaleType: 'SNOT_22' }, physicianUser);

      expect(result.total).toBe(2);
      expect(result.items.every((s) => s.scaleType === 'SNOT_22')).toBe(true);
    });

    it('should filter by date range (from/to)', async () => {
      await scaleRepo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date('2024-01-01'), scores: snot22Scores(1), total: 22, createdBy: userId });
      await scaleRepo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date('2024-05-01'), scores: snot22Scores(1), total: 22, createdBy: userId });

      const result = await controller.list(
        patientId,
        { from: '2024-03-01T00:00:00.000Z', to: '2024-06-30T00:00:00.000Z' },
        physicianUser,
      );

      expect(result.total).toBe(1);
      expect(result.items[0].date).toContain('2024-05-01');
    });

    it('should exclude soft-deleted scales', async () => {
      const s1 = await scaleRepo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date('2024-01-01'), scores: snot22Scores(1), total: 22, createdBy: userId });
      await scaleRepo.create({ organizationId: orgId, patientId, scaleType: 'SNOT_22', date: new Date('2024-01-02'), scores: snot22Scores(1), total: 22, createdBy: userId });
      await scaleRepo.softDelete(s1.id, orgId);

      const result = await controller.list(patientId, {}, physicianUser);
      expect(result.total).toBe(1);
    });
  });

  describe('GET /patients/:patientId/scales/:scaleId', () => {
    it('should return a single scale including scores', async () => {
      const created = await scaleRepo.create({
        organizationId: orgId,
        patientId,
        scaleType: 'SNOT_22',
        date: new Date('2024-03-15'),
        scores: snot22Scores(3),
        total: 66,
        createdBy: userId,
      });

      const result = await controller.get(patientId, created.id, physicianUser);

      expect(result.id).toBe(created.id);
      expect(result.scaleType).toBe('SNOT_22');
      expect(result.scores).toEqual(snot22Scores(3));
      expect(result.total).toBe(66);
    });

    it('should throw NotFoundException for missing scale', async () => {
      await expect(
        controller.get(patientId, 'nonexistent', physicianUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('PATCH /patients/:patientId/scales/:scaleId', () => {
    it('should update scores and recalculate total server-side', async () => {
      const created = await scaleRepo.create({
        organizationId: orgId,
        patientId,
        scaleType: 'SNOT_22',
        date: new Date('2024-03-15'),
        scores: snot22Scores(1), // total = 22
        total: 22,
        createdBy: userId,
      });

      const result = await controller.update(
        patientId,
        created.id,
        { scores: snot22Scores(3) }, // total should be 66
        physicianUser,
      );

      expect(result.total).toBe(66);
      expect(result.scores).toEqual(snot22Scores(3));
    });

    it('should update notes', async () => {
      const created = await scaleRepo.create({
        organizationId: orgId,
        patientId,
        scaleType: 'SNOT_22',
        date: new Date('2024-03-15'),
        scores: snot22Scores(1),
        total: 22,
        createdBy: userId,
      });

      const result = await controller.update(
        patientId,
        created.id,
        { notes: 'Updated notes' },
        physicianUser,
      );

      expect(result.notes).toBe('Updated notes');
    });

    it('should throw UnprocessableEntityException for invalid updated scores', async () => {
      const created = await scaleRepo.create({
        organizationId: orgId,
        patientId,
        scaleType: 'SNOT_22',
        date: new Date('2024-03-15'),
        scores: snot22Scores(1),
        total: 22,
        createdBy: userId,
      });

      await expect(
        controller.update(patientId, created.id, { scores: { item_1: 99 } }, physicianUser),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw NotFoundException for missing scale', async () => {
      await expect(
        controller.update(patientId, 'nonexistent', { notes: 'x' }, physicianUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('DELETE /patients/:patientId/scales/:scaleId', () => {
    it('should soft-delete the scale', async () => {
      const created = await scaleRepo.create({
        organizationId: orgId,
        patientId,
        scaleType: 'SNOT_22',
        date: new Date('2024-03-15'),
        scores: snot22Scores(1),
        total: 22,
        createdBy: userId,
      });

      const result = await controller.remove(patientId, created.id, physicianUser);

      expect(result.id).toBe(created.id);
      // Soft-deleted scale is excluded from list
      const list = await scaleRepo.listByPatient({ patientId, organizationId: orgId, page: 1, pageSize: 20 });
      expect(list.total).toBe(0);
    });

    it('should throw NotFoundException for missing scale', async () => {
      await expect(
        controller.remove(patientId, 'nonexistent', physicianUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
