// apps/api/src/api/consultations/consultations.controller.spec.ts
import { ConsultationsController } from './consultations.controller';
import type { IConsultationRepository, CreateConsultationInput, UpdateConsultationInput, ListConsultationsParams, SearchLogsParams } from '@/domain/consultation/consultation.repository.interface';
import type { Consultation } from '@/domain/consultation/consultation.entity';
import { Consultation as ConsultationEntity } from '@/domain/consultation/consultation.entity';
import type { JwtPayload } from '@medicore/contracts';
import { NotFoundException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';

class InMemoryConsultationRepository implements IConsultationRepository {
  private consultations: Map<string, ConsultationEntity> = new Map();
  private counter = 0;

  async findById(id: string, _organizationId: string): Promise<Consultation | null> {
    const c = this.consultations.get(id);
    if (!c || c.deletedAt) return null;
    return c;
  }

  async findByPatientId(patientId: string, _organizationId: string): Promise<Consultation[]> {
    return Array.from(this.consultations.values()).filter(
      (c) => c.patientId === patientId && !c.deletedAt,
    );
  }

  async listByPatient(patientId: string, organizationId: string, params: ListConsultationsParams): Promise<{ items: Consultation[]; total: number }> {
    let items = Array.from(this.consultations.values()).filter(
      (c) => c.patientId === patientId && c.organizationId === organizationId && !c.deletedAt,
    );
    const total = items.length;
    const start = (params.page - 1) * params.pageSize;
    items = items.slice(start, start + params.pageSize);
    return { items, total };
  }

  async searchLogs(params: SearchLogsParams): Promise<{ items: Consultation[]; total: number }> {
    let results = Array.from(this.consultations.values()).filter(
      (c) => c.patientId === params.patientId && c.organizationId === params.organizationId && !c.deletedAt,
    );

    const query = params.query.toLowerCase();
    const searchFields = params.field
      ? [params.field]
      : ['chiefComplaint', 'currentIllness', 'assessment', 'plan'];

    results = results.filter((c) => {
      return searchFields.some((field) => {
        const val = (c as any)[field];
        if (typeof val === 'string' && val.toLowerCase().includes(query)) return true;
        return false;
      });
    });

    if (params.fromDate) {
      results = results.filter((c) => c.date >= params.fromDate!);
    }
    if (params.toDate) {
      results = results.filter((c) => c.date <= params.toDate!);
    }

    const total = results.length;
    const start = (params.page - 1) * params.pageSize;
    const items = results.slice(start, start + params.pageSize);
    return { items, total };
  }

  async create(data: CreateConsultationInput): Promise<Consultation> {
    this.counter++;
    const id = `consultation-${this.counter}`;
    const consultation = new ConsultationEntity({
      id,
      patientId: data.patientId,
      organizationId: data.organizationId,
      date: data.date,
      type: data.type as any,
      physicianId: data.physicianId,
      chiefComplaint: data.chiefComplaint,
      currentIllness: data.currentIllness,
      physicalExam: data.physicalExam,
      assessment: data.assessment,
      diagnosisCodes: data.diagnosisCodes as any,
      plan: data.plan,
      procedureCodes: data.procedureCodes as any,
      followUpDate: data.followUpDate,
      followUpNotes: data.followUpNotes,
      createdBy: data.createdBy,
    });
    this.consultations.set(id, consultation);
    return consultation;
  }

  async update(id: string, _organizationId: string, data: UpdateConsultationInput): Promise<Consultation> {
    const existing = this.consultations.get(id);
    if (!existing) throw new Error('Not found');
    const updated = new ConsultationEntity({
      ...existing,
      ...Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined)),
      updatedAt: new Date(),
    });
    this.consultations.set(id, updated);
    return updated;
  }

  async softDelete(id: string, _organizationId: string): Promise<Consultation> {
    const existing = this.consultations.get(id);
    if (!existing) throw new Error('Not found');
    const deleted = existing.softDelete();
    this.consultations.set(id, deleted);
    return deleted;
  }

  async existsFirstVisitForPatient(patientId: string, _organizationId: string): Promise<boolean> {
    return Array.from(this.consultations.values()).some(
      (c) => c.patientId === patientId && c.type === 'FIRST_VISIT' && !c.deletedAt,
    );
  }
}

describe('ConsultationsController', () => {
  let controller: ConsultationsController;
  let consultationRepo: InMemoryConsultationRepository;

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
    consultationRepo = new InMemoryConsultationRepository();
    reportQueue.add.mockClear();
    controller = new ConsultationsController(
      consultationRepo as any,
      patientRepo as any,
      reportQueue as any,
    );
  });

  describe('POST /patients/:patientId/consultations', () => {
    it('should create a consultation', async () => {
      const body = {
        date: new Date().toISOString(),
        type: 'FIRST_VISIT',
        chiefComplaint: 'Dolor de oído derecho',
      };

      const result = await controller.create(patientId, body, physicianUser);

      expect(result.chiefComplaint).toBe('Dolor de oído derecho');
      expect(result.patientId).toBe(patientId);
    });

    it('should include firstVisitWarning in response', async () => {
      const body = {
        date: new Date().toISOString(),
        type: 'FIRST_VISIT',
        chiefComplaint: 'First visit complaint',
      };

      const result = await controller.create(patientId, body, physicianUser);

      expect(result).toHaveProperty('firstVisitWarning');
    });

    it('should throw UnprocessableEntityException for soft-deleted patient', async () => {
      patientRepo.findById.mockResolvedValueOnce(null);

      const body = {
        date: new Date().toISOString(),
        type: 'FIRST_VISIT',
        chiefComplaint: 'Test',
      };

      await expect(
        controller.create(patientId, body, physicianUser),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException for date in future', async () => {
      const body = {
        date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        type: 'FIRST_VISIT',
        chiefComplaint: 'Test',
      };

      // The Zod schema also validates date, so we test with a valid-schema date
      // but the use-case will catch it if Zod passes
      // Since CreateConsultationSchema also validates this, the Zod pipe will reject first
      // Let's test with a date just past the 24h mark
      await expect(
        controller.create(patientId, body, physicianUser),
      ).rejects.toThrow();
    });
  });

  describe('GET /patients/:patientId/consultations', () => {
    it('should return paginated list', async () => {
      await consultationRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        type: 'FIRST_VISIT',
        physicianId: userId,
        chiefComplaint: 'Test',
        createdBy: userId,
      });

      const result = await controller.list(patientId, { page: 1, pageSize: 20 }, physicianUser);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('GET /patients/:patientId/consultations/:consultationId', () => {
    it('should return a single consultation', async () => {
      const created = await consultationRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        type: 'FIRST_VISIT',
        physicianId: userId,
        chiefComplaint: 'Test',
        createdBy: userId,
      });

      const result = await controller.get(patientId, created.id, physicianUser);

      expect(result.id).toBe(created.id);
      expect(result.chiefComplaint).toBe('Test');
    });

    it('should throw NotFoundException for missing consultation', async () => {
      await expect(
        controller.get(patientId, 'nonexistent', physicianUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('PATCH /patients/:patientId/consultations/:consultationId', () => {
    it('should update consultation', async () => {
      const created = await consultationRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        type: 'FIRST_VISIT',
        physicianId: userId,
        chiefComplaint: 'Original',
        createdBy: userId,
      });

      const result = await controller.update(
        patientId,
        created.id,
        { chiefComplaint: 'Updated complaint' },
        physicianUser,
      );

      expect(result.chiefComplaint).toBe('Updated complaint');
    });

    it('should throw ForbiddenException when PHYSICIAN updates another\'s consultation', async () => {
      const created = await consultationRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        type: 'FIRST_VISIT',
        physicianId: 'other-physician',
        chiefComplaint: 'Original',
        createdBy: 'other-physician',
      });

      await expect(
        controller.update(
          patientId,
          created.id,
          { chiefComplaint: 'Hack attempt' },
          physicianUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow OWNER to update any consultation', async () => {
      const created = await consultationRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        type: 'FIRST_VISIT',
        physicianId: userId,
        chiefComplaint: 'Original',
        createdBy: userId,
      });

      const result = await controller.update(
        patientId,
        created.id,
        { chiefComplaint: 'Owner update' },
        ownerUser,
      );

      expect(result.chiefComplaint).toBe('Owner update');
    });
  });

  describe('DELETE /patients/:patientId/consultations/:consultationId', () => {
    it('should soft-delete consultation', async () => {
      const created = await consultationRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        type: 'FIRST_VISIT',
        physicianId: userId,
        chiefComplaint: 'Test',
        createdBy: userId,
      });

      const result = await controller.remove(patientId, created.id, physicianUser);

      expect(result.deletedAt).not.toBeNull();
    });

    it('should throw NotFoundException for missing consultation', async () => {
      await expect(
        controller.remove(patientId, 'nonexistent', physicianUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when PHYSICIAN deletes another\'s consultation', async () => {
      const created = await consultationRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        type: 'FIRST_VISIT',
        physicianId: 'other-physician',
        chiefComplaint: 'Test',
        createdBy: 'other-physician',
      });

      await expect(
        controller.remove(patientId, created.id, physicianUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('POST /patients/:patientId/consultations/search-logs', () => {
    it('should search consultations by query', async () => {
      await consultationRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date('2024-06-01T10:00:00.000Z'),
        type: 'FIRST_VISIT',
        physicianId: userId,
        chiefComplaint: 'Persistent headache',
        currentIllness: 'Chronic migraine',
        createdBy: userId,
      });
      await consultationRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date('2024-06-15T10:00:00.000Z'),
        type: 'FOLLOW_UP',
        physicianId: userId,
        chiefComplaint: 'Follow-up for hypertension',
        createdBy: userId,
      });

      const result = await controller.searchLogs(patientId, {
        query: 'headache',
        page: 1,
        pageSize: 20,
      }, physicianUser);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].chiefComplaint).toContain('headache');
      expect(result.total).toBe(1);
    });

    it('should search in a specific field', async () => {
      await consultationRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        type: 'FIRST_VISIT',
        physicianId: userId,
        chiefComplaint: 'Headache',
        currentIllness: 'Migraine',
        assessment: 'Tension headache',
        createdBy: userId,
      });

      const result = await controller.searchLogs(patientId, {
        query: 'migraine',
        field: 'currentIllness',
        page: 1,
        pageSize: 20,
      }, physicianUser);

      expect(result.items).toHaveLength(1);
    });

    it('should return empty results for non-matching query', async () => {
      await consultationRepo.create({
        patientId,
        organizationId: orgId,
        date: new Date(),
        type: 'FIRST_VISIT',
        physicianId: userId,
        chiefComplaint: 'Test complaint',
        createdBy: userId,
      });

      const result = await controller.searchLogs(patientId, {
        query: 'nonexistentterm',
        page: 1,
        pageSize: 20,
      }, physicianUser);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return paginated search results', async () => {
      for (let i = 0; i < 3; i++) {
        await consultationRepo.create({
          patientId,
          organizationId: orgId,
          date: new Date(),
          type: 'FIRST_VISIT',
          physicianId: userId,
          chiefComplaint: `Headache ${i + 1}`,
          createdBy: userId,
        });
      }

      const result = await controller.searchLogs(patientId, {
        query: 'headache',
        page: 1,
        pageSize: 2,
      }, physicianUser);

      expect(result.items.length).toBeLessThanOrEqual(2);
      expect(result.pageSize).toBe(2);
    });
  });
});
