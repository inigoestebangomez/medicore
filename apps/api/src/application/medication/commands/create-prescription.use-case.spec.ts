// apps/api/src/application/medication/commands/create-prescription.use-case.spec.ts
// MED-002: Allergy conflict detection (BR-MED-001)
// MED-003: Duplication warning (BR-MED-002)

import { describe, it, expect, beforeEach } from '@jest/globals';
import { CreatePrescriptionUseCase } from './create-prescription.use-case';
import { AllergyConflictCriticalError } from '@/domain/medication/errors/allergy-conflict-critical.error';
import { PatientNotActiveError } from '@/domain/consultation/errors/patient-not-active.error';
import { Allergy } from '@/domain/allergy/allergy.entity';
import { Medication } from '@/domain/medication/medication.entity';
import type { IMedicationRepository, CreateMedicationInput, UpdateMedicationInput, ListMedicationsParams } from '@/domain/medication/medication.repository.interface';
import type { IAllergyRepository } from '@/domain/allergy/allergy.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';

// ─────────────────────────────────────────────
// In-memory Medication repository
// ─────────────────────────────────────────────
class InMemoryMedicationRepo implements IMedicationRepository {
  private store = new Map<string, Medication>();
  private counter = 0;

  async findById(id: string, _org: string): Promise<Medication | null> {
    return this.store.get(id) ?? null;
  }
  async listByPatient(_p: ListMedicationsParams): Promise<{ items: Medication[]; total: number }> {
    const items = Array.from(this.store.values());
    return { items, total: items.length };
  }
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
    });
    this.store.set(med.id, med);
    return med;
  }
  async update(id: string, _org: string, _data: UpdateMedicationInput): Promise<Medication> {
    const existing = this.store.get(id)!;
    const updated = new Medication({ ...existing, ..._data } as any);
    this.store.set(id, updated);
    return updated;
  }
  async softDelete(id: string, _org: string): Promise<Medication> {
    const existing = this.store.get(id)!;
    const deleted = existing.softDelete();
    this.store.set(id, deleted);
    return deleted;
  }
  async findActiveByActiveIngredient(_patientId: string, _org: string, activeIngredient: string): Promise<Medication[]> {
    return Array.from(this.store.values()).filter(
      (m) => m.activeIngredient === activeIngredient && m.status === 'ACTIVE',
    );
  }
}

// ─────────────────────────────────────────────
// In-memory Allergy repository
// ─────────────────────────────────────────────
class InMemoryAllergyRepo implements IAllergyRepository {
  private store = new Map<string, Allergy>();

  seed(allergies: Allergy[]) {
    this.store.clear();
    for (const a of allergies) this.store.set(a.id, a);
  }

  async findByPatientId(_patientId: string, _org: string): Promise<Allergy[]> {
    return Array.from(this.store.values());
  }
  async findById(id: string, _org: string): Promise<Allergy | null> { return this.store.get(id) ?? null; }
  async create(_d: any): Promise<Allergy> { throw new Error('not implemented in test'); }
  async update(_id: string, _org: string, _d: any): Promise<Allergy> { throw new Error('not implemented in test'); }
  async softDelete(_id: string, _org: string): Promise<Allergy> { throw new Error('not implemented in test'); }
}

// ─────────────────────────────────────────────
// Minimal patient repository
// ─────────────────────────────────────────────
function makePatientRepo(patient: any | null) {
  return {
    findById: jest.fn().mockResolvedValue(patient ?? { id: 'patient-1', deletedAt: null }),
    findByIdWithAllergies: jest.fn().mockResolvedValue(patient ?? { id: 'patient-1' }),
  } as unknown as IPatientRepository;
}

function makeAllergy(id: string, substance: string, severity: any, deletedAt: Date | null = null): Allergy {
  return new Allergy({
    id,
    organizationId: 'org-1',
    patientId: 'patient-1',
    substance,
    severity,
    status: 'ACTIVE',
    createdBy: 'user-1',
    deletedAt,
  });
}

function makeCommand(overrides: Partial<any> = {}) {
  return {
    organizationId: 'org-1',
    patientId: 'patient-1',
    drugName: 'Amoxicillin',
    drugCode: undefined,
    activeIngredient: undefined,
    dosage: '500mg',
    frequency: 'every 8 hours',
    route: 'oral',
    startDate: new Date('2024-01-01'),
    physicianId: 'physician-1',
    createdBy: 'physician-1',
    ...overrides,
  };
}

describe('CreatePrescriptionUseCase', () => {
  let medRepo: InMemoryMedicationRepo;
  let allergyRepo: InMemoryAllergyRepo;
  let patientRepo: IPatientRepository;
  let useCase: CreatePrescriptionUseCase;

  beforeEach(() => {
    medRepo = new InMemoryMedicationRepo();
    allergyRepo = new InMemoryAllergyRepo();
    patientRepo = makePatientRepo(null);
    useCase = new CreatePrescriptionUseCase(medRepo, allergyRepo, patientRepo);
  });

  // ── MED-002: Allergy conflict detection ──
  describe('MED-002 — Allergy conflict detection (BR-MED-001)', () => {
    it('ANAPHYLAXIS allergy blocks prescription without override (422 ALLERGY_CONFLICT_CRITICAL)', async () => {
      allergyRepo.seed([makeAllergy('a-1', 'Amoxicillin', 'ANAPHYLAXIS')]);

      await expect(
        useCase.execute(makeCommand({ drugName: 'Amoxicillin' })),
      ).rejects.toThrow(AllergyConflictCriticalError);

      // Prescription is NOT created
      expect(medRepo.listByPatient({ patientId: 'patient-1', organizationId: 'org-1', page: 1, pageSize: 20 } as any))
        .resolves.toHaveProperty('total', 0);
    });

    it('ANAPHYLAXIS override with audit creates prescription with CRITICAL warning', async () => {
      allergyRepo.seed([makeAllergy('a-1', 'Amoxicillin', 'ANAPHYLAXIS')]);

      const result = await useCase.execute(
        makeCommand({ drugName: 'Amoxicillin', overrideCriticalAllergy: true }),
      );

      expect(result.medication.status).toBe('ACTIVE');
      expect(result.allergyWarning).toBeDefined();
      expect(result.allergyWarning!.level).toBe('CRITICAL');
      expect(result.allergyWarning!.substances).toContain('Amoxicillin');
    });

    it('SEVERE allergy produces warning but prescription is created', async () => {
      allergyRepo.seed([makeAllergy('a-1', 'Ibuprofen', 'SEVERE')]);

      const result = await useCase.execute(
        makeCommand({ drugName: 'Ibuprofen', activeIngredient: 'ibuprofen' }),
      );

      expect(result.medication.status).toBe('ACTIVE');
      expect(result.allergyWarning).toBeDefined();
      expect(result.allergyWarning!.level).toBe('SEVERE');
    });

    it('MILD allergy produces informational notice (MILD warning)', async () => {
      allergyRepo.seed([makeAllergy('a-1', 'Aspirin', 'MILD')]);

      const result = await useCase.execute(
        makeCommand({ drugName: 'Aspirin' }),
      );

      expect(result.medication.status).toBe('ACTIVE');
      expect(result.allergyWarning).toBeDefined();
      expect(result.allergyWarning!.level).toBe('MILD');
    });

    it('no active allergies → creates prescription without warnings', async () => {
      allergyRepo.seed([]);

      const result = await useCase.execute(makeCommand({ drugName: 'Paracetamol' }));

      expect(result.medication.status).toBe('ACTIVE');
      expect(result.allergyWarning).toBeUndefined();
    });

    it('inactive (soft-deleted / non-ACTIVE) allergies are ignored', async () => {
      const inactive = makeAllergy('a-1', 'Amoxicillin', 'ANAPHYLAXIS');
      const softDeleted = new Allergy({ ...inactive, deletedAt: new Date() });
      const inactiveStatus = new Allergy({ ...inactive, id: 'a-2', status: 'INACTIVE' });
      allergyRepo.seed([softDeleted, inactiveStatus]);

      const result = await useCase.execute(makeCommand({ drugName: 'Amoxicillin' }));

      expect(result.allergyWarning).toBeUndefined();
    });

    // MVP limitation: substance-name matching only
    it('MVP: does not detect different-name same-family drug (Penicillin allergy vs Amoxicillin)', async () => {
      allergyRepo.seed([makeAllergy('a-1', 'Penicillin', 'ANAPHYLAXIS')]);

      const result = await useCase.execute(
        makeCommand({ drugName: 'Amoxicillin', activeIngredient: 'amoxicillin' }),
      );

      // No conflict detected (substance-name matching only)
      expect(result.allergyWarning).toBeUndefined();
    });
  });

  // ── MED-003: Duplication warning ──
  describe('MED-003 — Duplication warning (BR-MED-002)', () => {
    it('duplicate active activeIngredient → duplicationWarning true', async () => {
      // Seed an existing ACTIVE prescription with same activeIngredient
      await medRepo.create({
        organizationId: 'org-1',
        patientId: 'patient-1',
        physicianId: 'physician-1',
        drugName: 'Omeprazol Brand',
        activeIngredient: 'Omeprazol',
        dosage: '20mg',
        frequency: 'once daily',
        startDate: new Date('2024-01-01'),
        status: 'ACTIVE',
        createdBy: 'physician-1',
      });

      const result = await useCase.execute(
        makeCommand({ drugName: 'Other Omeprazol', activeIngredient: 'Omeprazol' }),
      );

      expect(result.duplicationWarning).toBe(true);
      expect(result.medication.status).toBe('ACTIVE');
    });

    it('no existing active duplicate → duplicationWarning false', async () => {
      const result = await useCase.execute(
        makeCommand({ drugName: 'Paracetamol', activeIngredient: 'paracetamol' }),
      );
      expect(result.duplicationWarning).toBe(false);
    });

    it('no activeIngredient provided → skips duplication check (false)', async () => {
      const result = await useCase.execute(
        makeCommand({ drugName: 'Some drug', activeIngredient: undefined }),
      );
      expect(result.duplicationWarning).toBe(false);
    });
  });

  // ── Audit + NotFound ──
  describe('audit + patient validation', () => {
    it('throws PatientNotActiveError when patient not found', async () => {
      patientRepo = {
        ...makePatientRepo(null),
        findById: jest.fn().mockResolvedValue(null),
      } as any;
      useCase = new CreatePrescriptionUseCase(medRepo, allergyRepo, patientRepo);

      await expect(useCase.execute(makeCommand())).rejects.toThrow(PatientNotActiveError);
    });
  });
});