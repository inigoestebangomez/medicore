// apps/api/src/application/surgery/commands/create-surgery.use-case.spec.ts
import { CreateSurgeryUseCase } from './create-surgery.use-case';
import { InMemorySurgeryRepository } from './in-memory-surgery.repository';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import { Patient } from '@/domain/patient/patient.entity';
import { PatientNotActiveError } from '@/domain/consultation/errors/patient-not-active.error';
import { AsaRequiredError } from '@/domain/surgery/errors/asa-required.error';
import { InvalidProcedureCodeError } from '@/domain/surgery/errors/invalid-procedure-code.error';
import { DateInFutureError } from '@/domain/consultation/errors/date-in-future.error';

class InMemoryPatientRepository implements IPatientRepository {
  private patients: Map<string, Patient> = new Map();

  addPatient(patient: Patient) {
    this.patients.set(patient.id, patient);
  }

  async findById(id: string, _organizationId: string): Promise<Patient | null> {
    const p = this.patients.get(id);
    if (!p || p.deletedAt) return null;
    return p;
  }

  async findByIdWithAllergies(id: string, organizationId: string): Promise<Patient | null> {
    return this.findById(id, organizationId);
  }

  async findAll(_params: any): Promise<{ items: Patient[]; total: number }> {
    return { items: Array.from(this.patients.values()), total: this.patients.size };
  }

  async search(_params: any): Promise<{ items: Patient[]; total: number }> {
    return { items: [], total: 0 };
  }

  async findDuplicates(_organizationId: string, _lastName: string, _birthDate: Date): Promise<Patient[]> {
    return [];
  }

  async create(_data: any): Promise<Patient> {
    throw new Error('Not implemented');
  }

  async update(_id: string, _organizationId: string, _data: any): Promise<Patient> {
    throw new Error('Not implemented');
  }

  async softDelete(_id: string, _organizationId: string): Promise<Patient> {
    throw new Error('Not implemented');
  }

  async getNextNhcSequence(_organizationId: string): Promise<string> {
    return '2026-00001';
  }

  async hasScheduledSurgeries(_patientId: string, _organizationId: string): Promise<boolean> {
    return false;
  }

  async countByOrg(_organizationId: string): Promise<number> {
    return this.patients.size;
  }

  async findByNhc(_nhc: string, _organizationId: string): Promise<Patient | null> {
    return null;
  }
  async searchByNameFuzzy(_organizationId: string, _lastName: string, _firstName?: string): Promise<Patient[]> {
    return [];
  }
  async enrich(_id: string, _organizationId: string, _data: any, _updatedBy: string): Promise<Patient> {
    throw new Error('Not implemented');
  }
}

describe('CreateSurgeryUseCase', () => {
  let useCase: CreateSurgeryUseCase;
  let surgeryRepo: InMemorySurgeryRepository;
  let patientRepo: InMemoryPatientRepository;
  let reportQueue: { add: jest.Mock };

  const orgId = 'org-1';
  const patientId = 'patient-1';
  const physicianId = 'physician-1';
  const userId = 'user-1';

  beforeEach(() => {
    surgeryRepo = new InMemorySurgeryRepository();
    patientRepo = new InMemoryPatientRepository();
    reportQueue = { add: jest.fn().mockResolvedValue({}) };

    // Seed active patient
    patientRepo.addPatient(
      new Patient({
        id: patientId,
        organizationId: orgId,
        nhc: '2026-00001',
        firstName: 'María',
        lastName: 'García',
        birthDate: new Date('1984-03-12'),
        sex: 'FEMALE',
        createdBy: userId,
      }),
    );

    useCase = new CreateSurgeryUseCase(surgeryRepo, patientRepo, reportQueue);
  });

  const validCommand = {
    organizationId: orgId,
    patientId,
    date: new Date(),
    procedureType: 'Septoplastia bilateral',
    physicianId,
    createdBy: userId,
  };

  it('should create surgery successfully with default SCHEDULED status', async () => {
    const result = await useCase.execute(validCommand);

    expect(result.surgery).toBeDefined();
    expect(result.surgery.procedureType).toBe('Septoplastia bilateral');
    expect(result.surgery.patientId).toBe(patientId);
    expect(result.surgery.status).toBe('SCHEDULED');
    expect(result.consentWarning).toBe(false);
  });

  it('should throw PatientNotActiveError for soft-deleted patient', async () => {
    patientRepo = new InMemoryPatientRepository();
    patientRepo.addPatient(
      new Patient({
        id: patientId,
        organizationId: orgId,
        nhc: '2026-00001',
        firstName: 'María',
        lastName: 'García',
        birthDate: new Date('1984-03-12'),
        sex: 'FEMALE',
        createdBy: userId,
        deletedAt: new Date(),
      }),
    );
    useCase = new CreateSurgeryUseCase(surgeryRepo, patientRepo, reportQueue);

    await expect(useCase.execute(validCommand)).rejects.toThrow(PatientNotActiveError);
  });

  it('should throw PatientNotActiveError for non-existent patient', async () => {
    await expect(
      useCase.execute({ ...validCommand, patientId: 'nonexistent' }),
    ).rejects.toThrow(PatientNotActiveError);
  });

  it('should return consentWarning=false (for now)', async () => {
    const result = await useCase.execute(validCommand);
    expect(result.consentWarning).toBe(false);
  });

  it('should throw AsaRequiredError when status=COMPLETED and no ASA', async () => {
    await expect(
      useCase.execute({ ...validCommand, status: 'COMPLETED' }),
    ).rejects.toThrow(AsaRequiredError);
  });

  it('should throw DateInFutureError when status=COMPLETED and date > now', async () => {
    const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await expect(
      useCase.execute({ ...validCommand, status: 'COMPLETED', asa: 'ASA_II', date: futureDate }),
    ).rejects.toThrow(DateInFutureError);
  });

  it('should create COMPLETED surgery when ASA provided and date <= now', async () => {
    const result = await useCase.execute({
      ...validCommand,
      status: 'COMPLETED',
      asa: 'ASA_II',
      date: new Date(),
    });

    expect(result.surgery.status).toBe('COMPLETED');
    expect(result.surgery.asa).toBe('ASA_II');
  });

  it('should validate procedure codes against catalog', async () => {
    // Valid SNOMED codes should not throw
    const result = await useCase.execute({
      ...validCommand,
      procedureCodes: [{ system: 'ICD10', code: 'J01.90', description: 'Acute sinusitis' }],
    });
    expect(result.surgery).toBeDefined();
  });

  it('should throw InvalidProcedureCodeError for invalid procedure codes', async () => {
    await expect(
      useCase.execute({
        ...validCommand,
        procedureCodes: [{ system: 'SNOMED', code: 'INVALID_PROC', description: 'Fake procedure' }],
      }),
    ).rejects.toThrow(InvalidProcedureCodeError);
  });

  it('should list multiple invalid procedure codes in error', async () => {
    try {
      await useCase.execute({
        ...validCommand,
        procedureCodes: [
          { system: 'SNOMED', code: 'FAKE1', description: 'Fake 1' },
          { system: 'SNOMED', code: 'FAKE2', description: 'Fake 2' },
        ],
      });
      fail('Should have thrown InvalidProcedureCodeError');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidProcedureCodeError);
      expect((error as InvalidProcedureCodeError).invalidCodes).toContain('FAKE1');
      expect((error as InvalidProcedureCodeError).invalidCodes).toContain('FAKE2');
    }
  });

  it('should enqueue BullMQ job when generateReport=true', async () => {
    const result = await useCase.execute({ ...validCommand, generateReport: true });

    expect(reportQueue.add).toHaveBeenCalledWith('generate', expect.objectContaining({
      patientId,
      organizationId: orgId,
    }));
    expect(result.reportQueued).toBe(true);
  });

  it('should NOT enqueue when generateReport=false', async () => {
    await useCase.execute({ ...validCommand, generateReport: false });
    expect(reportQueue.add).not.toHaveBeenCalled();
  });

  it('should NOT enqueue when generateReport is undefined', async () => {
    await useCase.execute(validCommand);
    expect(reportQueue.add).not.toHaveBeenCalled();
  });
});