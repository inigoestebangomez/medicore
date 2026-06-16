// apps/api/src/api/surgeries/surgeries.controller.spec.ts
import { SurgeriesController } from './surgeries.controller';
import { InMemorySurgeryRepository } from '@/application/surgery/commands/in-memory-surgery.repository';
import type { JwtPayload } from '@medicore/contracts';
import { NotFoundException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';

describe('SurgeriesController', () => {
  let controller: SurgeriesController;
  let surgeryRepo: InMemorySurgeryRepository;

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

  const ownerUser: JwtPayload = {
    sub: 'owner-1',
    email: 'owner@test.com',
    name: 'Owner',
    organizationId: orgId,
    role: 'OWNER',
    iat: 1718000000,
    exp: 1718600000,
  };

  const reportQueue = {
    add: jest.fn().mockResolvedValue({}),
  };

  // Minimal patient repo that returns an active patient
  const patientRepo = {
    findById: jest.fn().mockResolvedValue({ id: patientId, deletedAt: null }),
    findByIdWithAllergies: jest.fn().mockResolvedValue({ id: patientId, deletedAt: null }),
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    search: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findDuplicates: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    getNextNhcSequence: jest.fn().mockResolvedValue('2026-00001'),
    hasScheduledSurgeries: jest.fn().mockResolvedValue(false),
    countByOrg: jest.fn().mockResolvedValue(1),
  };

  beforeEach(() => {
    surgeryRepo = new InMemorySurgeryRepository();
    reportQueue.add.mockClear();
    controller = new SurgeriesController(
      surgeryRepo as any,
      patientRepo as any,
      reportQueue as any,
    );
  });

  describe('POST /patients/:patientId/surgeries', () => {
    it('should create a surgery', async () => {
      const body = {
        date: new Date().toISOString(),
        procedureType: 'Appendectomy',
      };

      const result = await controller.create(patientId, body, physicianUser);

      expect(result.procedureType).toBe('Appendectomy');
      expect(result.patientId).toBe(patientId);
    });

    it('should include consentWarning and reportQueued in response', async () => {
      const body = {
        date: new Date().toISOString(),
        procedureType: 'Appendectomy',
        generateReport: true,
      };

      const result = await controller.create(patientId, body, physicianUser);

      expect(result).toHaveProperty('consentWarning');
      expect(result).toHaveProperty('reportQueued');
    });

    it('should throw UnprocessableEntityException for soft-deleted patient', async () => {
      patientRepo.findById.mockResolvedValueOnce(null);

      const body = {
        date: new Date().toISOString(),
        procedureType: 'Appendectomy',
      };

      await expect(
        controller.create(patientId, body, physicianUser),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('GET /patients/:patientId/surgeries', () => {
    it('should return paginated list', async () => {
      await surgeryRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        status: 'SCHEDULED',
        physicianId: userId,
        procedureType: 'Appendectomy',
        createdBy: userId,
      });

      const result = await controller.list(patientId, { page: 1, pageSize: 20 }, physicianUser);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should list with status filter', async () => {
      await surgeryRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        status: 'SCHEDULED',
        physicianId: userId,
        procedureType: 'Appendectomy',
        createdBy: userId,
      });
      await surgeryRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        status: 'COMPLETED',
        physicianId: userId,
        procedureType: 'Cholecystectomy',
        createdBy: userId,
      });

      const result = await controller.list(patientId, { page: 1, pageSize: 20, status: 'SCHEDULED' }, physicianUser);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('SCHEDULED');
    });
  });

  describe('GET /patients/:patientId/surgeries/:surgeryId', () => {
    it('should return a single surgery', async () => {
      const created = await surgeryRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        status: 'SCHEDULED',
        physicianId: userId,
        procedureType: 'Appendectomy',
        createdBy: userId,
      });

      const result = await controller.get(patientId, created.id, physicianUser);

      expect(result.id).toBe(created.id);
      expect(result.procedureType).toBe('Appendectomy');
    });

    it('should throw NotFoundException for missing surgery', async () => {
      await expect(
        controller.get(patientId, 'nonexistent', physicianUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('PATCH /patients/:patientId/surgeries/:surgeryId', () => {
    it('should update surgery', async () => {
      const created = await surgeryRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        status: 'SCHEDULED',
        physicianId: userId,
        procedureType: 'Appendectomy',
        createdBy: userId,
      });

      const result = await controller.update(
        patientId,
        created.id,
        { procedureType: 'Cholecystectomy', editReason: 'Correction' },
        physicianUser,
      );

      expect(result.procedureType).toBe('Cholecystectomy');
    });

    it('should throw ForbiddenException when PHYSICIAN updates another\'s surgery', async () => {
      const created = await surgeryRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        status: 'SCHEDULED',
        physicianId: 'other-physician',
        procedureType: 'Appendectomy',
        createdBy: 'other-physician',
      });

      await expect(
        controller.update(
          patientId,
          created.id,
          { procedureType: 'Hack attempt' },
          physicianUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow OWNER to update any surgery', async () => {
      const created = await surgeryRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        status: 'SCHEDULED',
        physicianId: userId,
        procedureType: 'Appendectomy',
        createdBy: userId,
      });

      const result = await controller.update(
        patientId,
        created.id,
        { procedureType: 'Owner update' },
        ownerUser,
      );

      expect(result.procedureType).toBe('Owner update');
    });
  });

  describe('POST /patients/:patientId/surgeries/:surgeryId/change-status', () => {
    it('should change status from SCHEDULED to COMPLETED', async () => {
      const created = await surgeryRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        status: 'SCHEDULED',
        physicianId: userId,
        procedureType: 'Appendectomy',
        asa: 'ASA_I',
        createdBy: userId,
      });

      const result = await controller.changeStatus(
        patientId,
        created.id,
        { targetStatus: 'COMPLETED', asa: 'ASA_I' },
        physicianUser,
      );

      expect(result.status).toBe('COMPLETED');
    });

    it('should throw UnprocessableEntityException for invalid transition', async () => {
      const created = await surgeryRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        status: 'COMPLETED',
        physicianId: userId,
        procedureType: 'Appendectomy',
        asa: 'ASA_I',
        createdBy: userId,
      });

      await expect(
        controller.changeStatus(
          patientId,
          created.id,
          { targetStatus: 'SCHEDULED' },
          physicianUser,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw AsaRequiredError when transitioning to COMPLETED without ASA', async () => {
      const created = await surgeryRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        status: 'SCHEDULED',
        physicianId: userId,
        procedureType: 'Appendectomy',
        createdBy: userId,
      });

      await expect(
        controller.changeStatus(
          patientId,
          created.id,
          { targetStatus: 'COMPLETED' },
          physicianUser,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('DELETE /patients/:patientId/surgeries/:surgeryId', () => {
    it('should soft-delete surgery', async () => {
      const created = await surgeryRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        status: 'SCHEDULED',
        physicianId: userId,
        procedureType: 'Appendectomy',
        createdBy: userId,
      });

      const result = await controller.remove(patientId, created.id, physicianUser);

      expect(result.deletedAt).not.toBeNull();
    });

    it('should throw NotFoundException for missing surgery', async () => {
      await expect(
        controller.remove(patientId, 'nonexistent', physicianUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when PHYSICIAN deletes another\'s surgery', async () => {
      const created = await surgeryRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        status: 'SCHEDULED',
        physicianId: 'other-physician',
        procedureType: 'Appendectomy',
        createdBy: 'other-physician',
      });

      await expect(
        controller.remove(patientId, created.id, physicianUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});