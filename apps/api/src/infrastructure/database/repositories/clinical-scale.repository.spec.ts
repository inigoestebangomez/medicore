// apps/api/src/infrastructure/database/repositories/clinical-scale.repository.spec.ts
// 5.8 — Integration: PrismaClinicalScaleRepository (create, soft-delete, list by type + date range)
// Pattern follows user.repository.spec.ts — mock PrismaService, verify query building + entity mapping.

import { PrismaClinicalScaleRepository } from './clinical-scale.repository';
import { ClinicalScale } from '@/domain/scale/clinical-scale.entity';

// Mock PrismaService — only the clinicalScale delegate is used.
const mockPrisma = {
  clinicalScale: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

describe('PrismaClinicalScaleRepository', () => {
  let repository: PrismaClinicalScaleRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PrismaClinicalScaleRepository(mockPrisma as any);
  });

  const snot22Scores: Record<string, number> = {};
  for (let i = 1; i <= 22; i++) snot22Scores[`item_${i}`] = 2; // total = 44

  const dbRecord = {
    id: 'scale-1',
    organizationId: 'org-1',
    patientId: 'patient-1',
    consultationId: 'cons-1',
    scaleType: 'SNOT_22',
    date: new Date('2024-03-15'),
    scores: snot22Scores,
    total: 44,
    notes: 'Baseline assessment',
    createdBy: 'physician-1',
    updatedBy: null,
    auditLog: null,
    createdAt: new Date('2024-03-15T10:00:00Z'),
    updatedAt: new Date('2024-03-15T10:00:00Z'),
    deletedAt: null,
  };

  describe('findById', () => {
    it('should return ClinicalScale entity when found', async () => {
      mockPrisma.clinicalScale.findFirst.mockResolvedValue(dbRecord);

      const result = await repository.findById('scale-1', 'org-1');

      expect(result).toBeInstanceOf(ClinicalScale);
      expect(result?.id).toBe('scale-1');
      expect(result?.scaleType).toBe('SNOT_22');
      expect(result?.total).toBe(44);
      // Filters by id + organizationId + excludes soft-deleted
      expect(mockPrisma.clinicalScale.findFirst).toHaveBeenCalledWith({
        where: { id: 'scale-1', organizationId: 'org-1', deletedAt: null },
      });
    });

    it('should return null when not found', async () => {
      mockPrisma.clinicalScale.findFirst.mockResolvedValue(null);
      const result = await repository.findById('nope', 'org-1');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should map input to Prisma create and return ClinicalScale entity', async () => {
      mockPrisma.clinicalScale.create.mockResolvedValue(dbRecord);

      const result = await repository.create({
        organizationId: 'org-1',
        patientId: 'patient-1',
        consultationId: 'cons-1',
        scaleType: 'SNOT_22',
        date: new Date('2024-03-15'),
        scores: snot22Scores,
        total: 44,
        notes: 'Baseline assessment',
        createdBy: 'physician-1',
      });

      expect(result).toBeInstanceOf(ClinicalScale);
      expect(result.total).toBe(44);
      expect(mockPrisma.clinicalScale.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          patientId: 'patient-1',
          scaleType: 'SNOT_22',
          total: 44,
          createdBy: 'physician-1',
        }),
      });
    });
  });

  describe('softDelete', () => {
    it('should set deletedAt via prisma.update and return entity', async () => {
      const deletedRecord = { ...dbRecord, deletedAt: new Date('2024-04-01') };
      mockPrisma.clinicalScale.update.mockResolvedValue(deletedRecord);

      const result = await repository.softDelete('scale-1', 'org-1');

      expect(result).toBeInstanceOf(ClinicalScale);
      expect(result.deletedAt).not.toBeNull();
      expect(mockPrisma.clinicalScale.update).toHaveBeenCalledWith({
        where: { id: 'scale-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('listByPatient', () => {
    it('should return mapped entities and total', async () => {
      mockPrisma.clinicalScale.findMany.mockResolvedValue([dbRecord]);
      mockPrisma.clinicalScale.count.mockResolvedValue(1);

      const result = await repository.listByPatient({
        patientId: 'patient-1',
        organizationId: 'org-1',
        page: 1,
        pageSize: 20,
      });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toBeInstanceOf(ClinicalScale);
    });

    it('should apply scaleType filter when provided', async () => {
      mockPrisma.clinicalScale.findMany.mockResolvedValue([]);
      mockPrisma.clinicalScale.count.mockResolvedValue(0);

      await repository.listByPatient({
        patientId: 'patient-1',
        organizationId: 'org-1',
        page: 1,
        pageSize: 20,
        scaleType: 'SNOT_22',
      });

      const expectedWhere = {
        patientId: 'patient-1',
        organizationId: 'org-1',
        deletedAt: null,
        scaleType: 'SNOT_22',
      };
      expect(mockPrisma.clinicalScale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(mockPrisma.clinicalScale.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it('should omit scaleType filter when not provided', async () => {
      mockPrisma.clinicalScale.findMany.mockResolvedValue([]);
      mockPrisma.clinicalScale.count.mockResolvedValue(0);

      await repository.listByPatient({
        patientId: 'patient-1',
        organizationId: 'org-1',
        page: 1,
        pageSize: 20,
      });

      const expectedWhere = {
        patientId: 'patient-1',
        organizationId: 'org-1',
        deletedAt: null,
      };
      expect(mockPrisma.clinicalScale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it('should apply date range filter (from as gte, to as lte)', async () => {
      mockPrisma.clinicalScale.findMany.mockResolvedValue([]);
      mockPrisma.clinicalScale.count.mockResolvedValue(0);

      const from = new Date('2024-03-01');
      const to = new Date('2024-06-30');

      await repository.listByPatient({
        patientId: 'patient-1',
        organizationId: 'org-1',
        page: 1,
        pageSize: 20,
        from,
        to,
      });

      const expectedWhere = {
        patientId: 'patient-1',
        organizationId: 'org-1',
        deletedAt: null,
        date: { gte: from, lte: to },
      };
      expect(mockPrisma.clinicalScale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it('should apply only `from` (gte) when `to` is omitted', async () => {
      mockPrisma.clinicalScale.findMany.mockResolvedValue([]);
      mockPrisma.clinicalScale.count.mockResolvedValue(0);

      const from = new Date('2024-03-01');

      await repository.listByPatient({
        patientId: 'patient-1',
        organizationId: 'org-1',
        page: 1,
        pageSize: 20,
        from,
      });

      expect(mockPrisma.clinicalScale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ date: { gte: from } }) }),
      );
    });

    it('should combine scaleType + date range filters', async () => {
      mockPrisma.clinicalScale.findMany.mockResolvedValue([]);
      mockPrisma.clinicalScale.count.mockResolvedValue(0);

      const from = new Date('2024-03-01');
      const to = new Date('2024-06-30');

      await repository.listByPatient({
        patientId: 'patient-1',
        organizationId: 'org-1',
        page: 1,
        pageSize: 20,
        scaleType: 'DHI',
        from,
        to,
      });

      const expectedWhere = {
        patientId: 'patient-1',
        organizationId: 'org-1',
        deletedAt: null,
        scaleType: 'DHI',
        date: { gte: from, lte: to },
      };
      expect(mockPrisma.clinicalScale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it('should order by date descending (BR-SCA-003) and apply pagination', async () => {
      mockPrisma.clinicalScale.findMany.mockResolvedValue([]);
      mockPrisma.clinicalScale.count.mockResolvedValue(0);

      await repository.listByPatient({
        patientId: 'patient-1',
        organizationId: 'org-1',
        page: 2,
        pageSize: 5,
      });

      expect(mockPrisma.clinicalScale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { date: 'desc' },
          skip: 5, // (2 - 1) * 5
          take: 5,
        }),
      );
    });
  });

  describe('update', () => {
    it('should call prisma.update with merged data and return entity', async () => {
      const updatedRecord = { ...dbRecord, notes: 'Updated notes', updatedBy: 'physician-1' };
      mockPrisma.clinicalScale.update.mockResolvedValue(updatedRecord);

      const result = await repository.update('scale-1', 'org-1', {
        notes: 'Updated notes',
        updatedBy: 'physician-1',
      });

      expect(result).toBeInstanceOf(ClinicalScale);
      expect(result.notes).toBe('Updated notes');
      expect(mockPrisma.clinicalScale.update).toHaveBeenCalledWith({
        where: { id: 'scale-1' },
        data: expect.objectContaining({
          notes: 'Updated notes',
          updatedBy: 'physician-1',
          updatedAt: expect.any(Date),
        }),
      });
    });
  });
});
