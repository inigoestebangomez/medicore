// apps/api/src/api/medications/medications.controller.spec.ts
// 5.9 — API tests: MedicationsController (allergy override header, 422 on invalid transition, audit entries)

import { MedicationsController } from './medications.controller';
import type {
  IMedicationRepository,
  CreateMedicationInput,
  UpdateMedicationInput,
  ListMedicationsParams,
} from '@/domain/medication/medication.repository.interface';
import type { IAllergyRepository } from '@/domain/allergy/allergy.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import { Medication } from '@/domain/medication/medication.entity';
import { Allergy } from '@/domain/allergy/allergy.entity';
import type { JwtPayload } from '@medicore/contracts';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

// ─────────────────────────────────────────────
// In-memory Medication repository — captures audit logs
// ─────────────────────────────────────────────
class InMemoryMedicationRepository implements IMedicationRepository {
  private store = new Map<string, Medication>();
  private counter = 0;

  async create(data: CreateMedicationInput): Promise<Medication> {
    this.counter++;
    const med = new Medication({
      id: `med-${this.counter}`,
      organizationId: data.organizationId,
      patientId: data.patientId,
      consultationId: data.consultationId ?? null,
      physicianId: data.physicianId,
      drugName: data.drugName,
      drugCode: data.drugCode ?? null,
      activeIngredient: data.activeIngredient ?? null,
      dosage: data.dosage,
      frequency: data.frequency,
      route: data.route ?? null,
      form: data.form ?? null,
      startDate: data.startDate,
      endDate: data.endDate ?? null,
      duration: data.duration ?? null,
      status: data.status ?? 'ACTIVE',
      instructions: data.instructions ?? null,
      reason: data.reason ?? null,
      createdBy: data.createdBy,
      auditLog: data.auditLog ?? null,
    });
    this.store.set(med.id, med);
    return med;
  }

  async findById(id: string, _org: string): Promise<Medication | null> {
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

  async update(id: string, _org: string, data: UpdateMedicationInput): Promise<Medication> {
    const existing = this.store.get(id);
    if (!existing) throw new Error('Not found');
    const updated = new Medication({
      ...existing,
      ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
      updatedAt: new Date(),
    } as any);
    this.store.set(id, updated);
    return updated;
  }

  async softDelete(id: string, _org: string): Promise<Medication> {
    const existing = this.store.get(id);
    if (!existing) throw new Error('Not found');
    const deleted = existing.softDelete();
    this.store.set(id, deleted);
    return deleted;
  }

  async findActiveByActiveIngredient(patientId: string, _org: string, activeIngredient: string): Promise<Medication[]> {
    return Array.from(this.store.values()).filter(
      (m) => m.patientId === patientId && m.activeIngredient === activeIngredient && m.status === 'ACTIVE' && !m.deletedAt,
    );
  }
}

// ─────────────────────────────────────────────
// In-memory Allergy repository
// ─────────────────────────────────────────────
class InMemoryAllergyRepository implements IAllergyRepository {
  private store = new Map<string, Allergy>();

  seed(allergies: Allergy[]) {
    this.store.clear();
    for (const a of allergies) this.store.set(a.id, a);
  }

  async findByPatientId(_patientId: string, _org: string): Promise<Allergy[]> {
    return Array.from(this.store.values());
  }
  async findById(id: string, _org: string): Promise<Allergy | null> { return this.store.get(id) ?? null; }
  async create(_d: any): Promise<Allergy> { throw new Error('not implemented'); }
  async update(_id: string, _org: string, _d: any): Promise<Allergy> { throw new Error('not implemented'); }
  async softDelete(_id: string, _org: string): Promise<Allergy> { throw new Error('not implemented'); }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function makeAllergy(id: string, substance: string, severity: any): Allergy {
  return new Allergy({
    id,
    organizationId: 'org-1',
    patientId: 'patient-1',
    substance,
    severity,
    status: 'ACTIVE',
    createdBy: 'user-1',
  });
}

function makePatientRepo(): IPatientRepository {
  return {
    findById: jest.fn().mockResolvedValue({ id: 'patient-1', deletedAt: null }),
  } as any;
}

describe('MedicationsController', () => {
  let controller: MedicationsController;
  let medicationRepo: InMemoryMedicationRepository;
  let allergyRepo: InMemoryAllergyRepository;
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

  function validBody(overrides: Partial<any> = {}) {
    return {
      drugName: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'every 8h',
      startDate: '2024-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  beforeEach(() => {
    medicationRepo = new InMemoryMedicationRepository();
    allergyRepo = new InMemoryAllergyRepository();
    patientRepo = makePatientRepo();
    controller = new MedicationsController(medicationRepo as any, allergyRepo as any, patientRepo);
  });

  describe('POST /patients/:patientId/medications', () => {
    it('should create a prescription with no allergies (no warnings)', async () => {
      allergyRepo.seed([]);

      const result = await controller.create(patientId, validBody(), undefined, physicianUser);

      expect(result.status).toBe('ACTIVE');
      expect(result.drugName).toBe('Amoxicillin');
      expect(result.allergyWarning).toBeUndefined();
      expect(result.duplicationWarning).toBeUndefined();
    });

    it('should record a CREATE audit entry on creation', async () => {
      allergyRepo.seed([]);

      const result = await controller.create(patientId, validBody(), undefined, physicianUser);

      const stored = await medicationRepo.findById(result.id, orgId);
      expect(stored?.auditLog).not.toBeNull();
      expect(stored?.auditLog?.[0].action).toBe('CREATE');
      expect(stored?.auditLog?.[0].performedBy).toBe(userId);
      expect(stored?.auditLog?.[0].details).toBe('Prescription created');
    });

    it('ANAPHYLAXIS allergy without override → 422 UnprocessableEntityException', async () => {
      allergyRepo.seed([makeAllergy('a-1', 'Amoxicillin', 'ANAPHYLAXIS')]);

      await expect(
        controller.create(patientId, validBody(), undefined, physicianUser),
      ).rejects.toThrow(UnprocessableEntityException);

      // Prescription is NOT created
      const list = await medicationRepo.listByPatient({ patientId, organizationId: orgId, page: 1, pageSize: 20 });
      expect(list.total).toBe(0);
    });

    it('ANAPHYLAXIS allergy WITH override header creates prescription + CRITICAL warning + override audit', async () => {
      allergyRepo.seed([makeAllergy('a-1', 'Amoxicillin', 'ANAPHYLAXIS')]);

      const result = await controller.create(patientId, validBody(), 'confirmed', physicianUser);

      expect(result.status).toBe('ACTIVE');
      expect(result.allergyWarning).toBeDefined();
      expect(result.allergyWarning!.level).toBe('CRITICAL');
      expect(result.allergyWarning!.substances).toContain('Amoxicillin');

      // Audit entry records the override
      const stored = await medicationRepo.findById(result.id, orgId);
      expect(stored?.auditLog?.[0].action).toBe('CREATE');
      expect(stored?.auditLog?.[0].details).toContain('critical allergy override');
      expect(stored?.auditLog?.[0].details).toContain('Amoxicillin');
    });

    it('override header with any value other than "confirmed" does NOT override', async () => {
      allergyRepo.seed([makeAllergy('a-1', 'Amoxicillin', 'ANAPHYLAXIS')]);

      await expect(
        controller.create(patientId, validBody(), 'maybe', physicianUser),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('SEVERE allergy produces warning but prescription is created', async () => {
      allergyRepo.seed([makeAllergy('a-1', 'Ibuprofen', 'SEVERE')]);

      const result = await controller.create(
        patientId,
        validBody({ drugName: 'Ibuprofen', activeIngredient: 'ibuprofen' }),
        undefined,
        physicianUser,
      );

      expect(result.status).toBe('ACTIVE');
      expect(result.allergyWarning).toBeDefined();
      expect(result.allergyWarning!.level).toBe('SEVERE');
    });

    it('duplication warning when same activeIngredient ACTIVE exists', async () => {
      allergyRepo.seed([]);
      // Seed an existing ACTIVE prescription with same activeIngredient
      await medicationRepo.create({
        organizationId: orgId,
        patientId,
        physicianId: userId,
        drugName: 'Omeprazol Brand',
        activeIngredient: 'Omeprazol',
        dosage: '20mg',
        frequency: 'once daily',
        startDate: new Date('2024-01-01'),
        status: 'ACTIVE',
        createdBy: userId,
      });

      const result = await controller.create(
        patientId,
        validBody({ drugName: 'Other Omeprazol', activeIngredient: 'Omeprazol' }),
        undefined,
        physicianUser,
      );

      expect(result.duplicationWarning).toBe(true);
    });

    it('throws UnprocessableEntityException when patient not found', async () => {
      (patientRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        controller.create(patientId, validBody(), undefined, physicianUser),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('GET /patients/:patientId/medications', () => {
    it('should return paginated list', async () => {
      await medicationRepo.create({
        organizationId: orgId,
        patientId,
        physicianId: userId,
        drugName: 'Drug A',
        dosage: '10mg',
        frequency: 'daily',
        startDate: new Date('2024-01-01'),
        status: 'ACTIVE',
        createdBy: userId,
      });
      await medicationRepo.create({
        organizationId: orgId,
        patientId,
        physicianId: userId,
        drugName: 'Drug B',
        dosage: '20mg',
        frequency: 'daily',
        startDate: new Date('2024-01-02'),
        status: 'DISCONTINUED',
        createdBy: userId,
      });

      const result = await controller.list(patientId, {}, physicianUser);

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should filter by status when provided', async () => {
      await medicationRepo.create({
        organizationId: orgId,
        patientId,
        physicianId: userId,
        drugName: 'Active Drug',
        dosage: '10mg',
        frequency: 'daily',
        startDate: new Date('2024-01-01'),
        status: 'ACTIVE',
        createdBy: userId,
      });
      await medicationRepo.create({
        organizationId: orgId,
        patientId,
        physicianId: userId,
        drugName: 'Discontinued Drug',
        dosage: '20mg',
        frequency: 'daily',
        startDate: new Date('2024-01-02'),
        status: 'DISCONTINUED',
        createdBy: userId,
      });

      const result = await controller.list(patientId, { status: 'ACTIVE' }, physicianUser);

      expect(result.total).toBe(1);
      expect(result.items[0].status).toBe('ACTIVE');
    });
  });

  describe('GET /patients/:patientId/medications/:medicationId', () => {
    it('should return a single medication', async () => {
      const created = await medicationRepo.create({
        organizationId: orgId,
        patientId,
        physicianId: userId,
        drugName: 'Test Drug',
        dosage: '5mg',
        frequency: 'daily',
        startDate: new Date('2024-01-01'),
        status: 'ACTIVE',
        createdBy: userId,
      });

      const result = await controller.get(patientId, created.id, physicianUser);

      expect(result.id).toBe(created.id);
      expect(result.drugName).toBe('Test Drug');
    });

    it('should throw NotFoundException for missing medication', async () => {
      await expect(
        controller.get(patientId, 'nonexistent', physicianUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('PATCH /patients/:patientId/medications/:medicationId/discontinue', () => {
    it('should discontinue an ACTIVE prescription with reason + audit DISCONTINUE', async () => {
      const created = await medicationRepo.create({
        organizationId: orgId,
        patientId,
        physicianId: userId,
        drugName: 'Test Drug',
        dosage: '5mg',
        frequency: 'daily',
        startDate: new Date('2024-01-01'),
        status: 'ACTIVE',
        createdBy: userId,
      });

      const result = await controller.discontinue(
        patientId,
        created.id,
        { discontinuationReason: 'Adverse reaction: nausea' },
        physicianUser,
      );

      expect(result.status).toBe('DISCONTINUED');
      expect(result.discontinuationReason).toBe('Adverse reaction: nausea');

      // Audit entry for discontinuation
      const stored = await medicationRepo.findById(created.id, orgId);
      expect(stored?.auditLog).not.toBeNull();
      const discontinueEntry = stored?.auditLog?.find((e) => e.action === 'DISCONTINUE');
      expect(discontinueEntry).toBeDefined();
      expect(discontinueEntry?.details).toContain('Adverse reaction: nausea');
    });

    it('422 on invalid transition (discontinue a COMPLETED prescription)', async () => {
      const created = await medicationRepo.create({
        organizationId: orgId,
        patientId,
        physicianId: userId,
        drugName: 'Completed Drug',
        dosage: '5mg',
        frequency: 'daily',
        startDate: new Date('2024-01-01'),
        status: 'COMPLETED',
        createdBy: userId,
      });

      await expect(
        controller.discontinue(patientId, created.id, { discontinuationReason: 'Trying' }, physicianUser),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when discontinuing without reason', async () => {
      const created = await medicationRepo.create({
        organizationId: orgId,
        patientId,
        physicianId: userId,
        drugName: 'Active Drug',
        dosage: '5mg',
        frequency: 'daily',
        startDate: new Date('2024-01-01'),
        status: 'ACTIVE',
        createdBy: userId,
      });

      // The Zod pipe would reject empty reason; calling directly with empty string hits the use case
      await expect(
        controller.discontinue(patientId, created.id, { discontinuationReason: '' }, physicianUser),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw NotFoundException for missing medication', async () => {
      await expect(
        controller.discontinue(patientId, 'nonexistent', { discontinuationReason: 'Reason' }, physicianUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('DELETE /patients/:patientId/medications/:medicationId', () => {
    it('should soft-delete the medication', async () => {
      const created = await medicationRepo.create({
        organizationId: orgId,
        patientId,
        physicianId: userId,
        drugName: 'Test Drug',
        dosage: '5mg',
        frequency: 'daily',
        startDate: new Date('2024-01-01'),
        status: 'ACTIVE',
        createdBy: userId,
      });

      const result = await controller.remove(patientId, created.id, physicianUser);

      expect(result.id).toBe(created.id);
      // Soft-deleted medication is excluded from list
      const list = await medicationRepo.listByPatient({ patientId, organizationId: orgId, page: 1, pageSize: 20 });
      expect(list.total).toBe(0);
    });

    it('should throw NotFoundException for missing medication', async () => {
      await expect(
        controller.remove(patientId, 'nonexistent', physicianUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
