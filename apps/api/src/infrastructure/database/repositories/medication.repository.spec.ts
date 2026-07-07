// apps/api/src/infrastructure/database/repositories/medication.repository.spec.ts
// 5.7 — Integration: PrismaMedicationRepository (create, list with status filter, soft-delete)
// Pattern follows user.repository.spec.ts — mock PrismaService, verify query building + entity mapping.

import { PrismaMedicationRepository } from './medication.repository';
import { Medication } from '@/domain/medication/medication.entity';

// Mock PrismaService — only the medicationPrescription delegate is used.
const mockPrisma = {
  medicationPrescription: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

describe('PrismaMedicationRepository', () => {
  let repository: PrismaMedicationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PrismaMedicationRepository(mockPrisma as any);
  });

  const dbRecord = {
    id: 'med-1',
    organizationId: 'org-1',
    patientId: 'patient-1',
    consultationId: 'cons-1',
    physicianId: 'physician-1',
    drugName: 'Amoxicillin',
    drugCode: 'AMX-500',
    activeIngredient: 'amoxicillin',
    dosage: '500mg',
    frequency: 'every 8h',
    route: 'oral',
    form: 'capsule',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-02-01'),
    duration: '10 days',
    status: 'ACTIVE',
    instructions: 'Take with food',
    reason: 'Infection',
    discontinuationReason: null,
    createdBy: 'physician-1',
    updatedBy: null,
    auditLog: null,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    deletedAt: null,
  };

  describe('findById', () => {
    it('should return Medication entity when found', async () => {
      mockPrisma.medicationPrescription.findFirst.mockResolvedValue(dbRecord);

      const result = await repository.findById('med-1', 'org-1');

      expect(result).toBeInstanceOf(Medication);
      expect(result?.id).toBe('med-1');
      expect(result?.drugName).toBe('Amoxicillin');
      expect(result?.status).toBe('ACTIVE');
      // Filters by id + organizationId + excludes soft-deleted
      expect(mockPrisma.medicationPrescription.findFirst).toHaveBeenCalledWith({
        where: { id: 'med-1', organizationId: 'org-1', deletedAt: null },
      });
    });

    it('should return null when not found', async () => {
      mockPrisma.medicationPrescription.findFirst.mockResolvedValue(null);
      const result = await repository.findById('nope', 'org-1');
      expect(result).toBeNull();
    });
  });

  describe('listByPatient', () => {
    it('should return mapped entities and total', async () => {
      mockPrisma.medicationPrescription.findMany.mockResolvedValue([dbRecord]);
      mockPrisma.medicationPrescription.count.mockResolvedValue(1);

      const result = await repository.listByPatient({
        patientId: 'patient-1',
        organizationId: 'org-1',
        page: 1,
        pageSize: 20,
      });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toBeInstanceOf(Medication);
    });

    it('should apply status filter when status is provided', async () => {
      mockPrisma.medicationPrescription.findMany.mockResolvedValue([]);
      mockPrisma.medicationPrescription.count.mockResolvedValue(0);

      await repository.listByPatient({
        patientId: 'patient-1',
        organizationId: 'org-1',
        page: 1,
        pageSize: 20,
        status: 'ACTIVE',
      });

      const expectedWhere = {
        patientId: 'patient-1',
        organizationId: 'org-1',
        deletedAt: null,
        status: 'ACTIVE',
      };
      expect(mockPrisma.medicationPrescription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(mockPrisma.medicationPrescription.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it('should omit status filter when status is not provided (list all)', async () => {
      mockPrisma.medicationPrescription.findMany.mockResolvedValue([]);
      mockPrisma.medicationPrescription.count.mockResolvedValue(0);

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
      expect(mockPrisma.medicationPrescription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it('should apply pagination (skip + take) and order by createdAt desc', async () => {
      mockPrisma.medicationPrescription.findMany.mockResolvedValue([]);
      mockPrisma.medicationPrescription.count.mockResolvedValue(0);

      await repository.listByPatient({
        patientId: 'patient-1',
        organizationId: 'org-1',
        page: 2,
        pageSize: 10,
      });

      expect(mockPrisma.medicationPrescription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          skip: 10, // (2 - 1) * 10
          take: 10,
        }),
      );
    });
  });

  describe('create', () => {
    it('should map input to Prisma create and return Medication entity', async () => {
      mockPrisma.medicationPrescription.create.mockResolvedValue(dbRecord);

      const result = await repository.create({
        organizationId: 'org-1',
        patientId: 'patient-1',
        consultationId: 'cons-1',
        physicianId: 'physician-1',
        drugName: 'Amoxicillin',
        drugCode: 'AMX-500',
        activeIngredient: 'amoxicillin',
        dosage: '500mg',
        frequency: 'every 8h',
        route: 'oral',
        form: 'capsule',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-02-01'),
        duration: '10 days',
        status: 'ACTIVE',
        instructions: 'Take with food',
        reason: 'Infection',
        createdBy: 'physician-1',
      });

      expect(result).toBeInstanceOf(Medication);
      expect(result.drugName).toBe('Amoxicillin');

      // Verify the create payload maps all fields
      expect(mockPrisma.medicationPrescription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          patientId: 'patient-1',
          physicianId: 'physician-1',
          drugName: 'Amoxicillin',
          dosage: '500mg',
          status: 'ACTIVE',
          createdBy: 'physician-1',
        }),
      });
    });
  });

  describe('update', () => {
    it('should call prisma.update with merged data and return entity', async () => {
      const updatedRecord = { ...dbRecord, status: 'DISCONTINUED', discontinuationReason: 'Side effects' };
      mockPrisma.medicationPrescription.update.mockResolvedValue(updatedRecord);

      const result = await repository.update('med-1', 'org-1', {
        status: 'DISCONTINUED',
        discontinuationReason: 'Side effects',
        updatedBy: 'physician-1',
      });

      expect(result).toBeInstanceOf(Medication);
      expect(result.status).toBe('DISCONTINUED');
      expect(result.discontinuationReason).toBe('Side effects');
      expect(mockPrisma.medicationPrescription.update).toHaveBeenCalledWith({
        where: { id: 'med-1' },
        data: expect.objectContaining({
          status: 'DISCONTINUED',
          discontinuationReason: 'Side effects',
          updatedBy: 'physician-1',
          updatedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('softDelete', () => {
    it('should set deletedAt via prisma.update and return entity', async () => {
      const deletedRecord = { ...dbRecord, deletedAt: new Date('2024-03-01') };
      mockPrisma.medicationPrescription.update.mockResolvedValue(deletedRecord);

      const result = await repository.softDelete('med-1', 'org-1');

      expect(result).toBeInstanceOf(Medication);
      expect(result.deletedAt).not.toBeNull();
      expect(mockPrisma.medicationPrescription.update).toHaveBeenCalledWith({
        where: { id: 'med-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('findActiveByActiveIngredient', () => {
    it('should query ACTIVE prescriptions by activeIngredient and return entities', async () => {
      mockPrisma.medicationPrescription.findMany.mockResolvedValue([dbRecord]);

      const result = await repository.findActiveByActiveIngredient('patient-1', 'org-1', 'amoxicillin');

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Medication);
      expect(mockPrisma.medicationPrescription.findMany).toHaveBeenCalledWith({
        where: {
          patientId: 'patient-1',
          organizationId: 'org-1',
          activeIngredient: 'amoxicillin',
          status: 'ACTIVE',
          deletedAt: null,
        },
      });
    });

    it('should return empty array when no active duplicates', async () => {
      mockPrisma.medicationPrescription.findMany.mockResolvedValue([]);
      const result = await repository.findActiveByActiveIngredient('patient-1', 'org-1', 'paracetamol');
      expect(result).toEqual([]);
    });
  });
});
