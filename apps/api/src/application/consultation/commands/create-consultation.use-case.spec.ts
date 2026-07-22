// apps/api/src/application/consultation/commands/create-consultation.use-case.spec.ts
import { CreateConsultationUseCase } from './create-consultation.use-case';
import type { IConsultationRepository, CreateConsultationInput } from '@/domain/consultation/consultation.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import type { Consultation } from '@/domain/consultation/consultation.entity';
import { Consultation as ConsultationEntity } from '@/domain/consultation/consultation.entity';
import { PatientNotActiveError } from '@/domain/consultation/errors/patient-not-active.error';
import { DateInFutureError } from '@/domain/consultation/errors/date-in-future.error';
import { InvalidDiagnosisCodeError } from '@/domain/consultation/errors/invalid-diagnosis-code.error';
import { InvalidProcedureCodeError } from '@/domain/consultation/errors/invalid-procedure-code.error';
import { Patient } from '@/domain/patient/patient.entity';

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

  async listByPatient(patientId: string, organizationId: string, params: any): Promise<{ items: Consultation[]; total: number }> {
    let items = Array.from(this.consultations.values()).filter(
      (c) => c.patientId === patientId && c.organizationId === organizationId && !c.deletedAt,
    );
    const total = items.length;
    const start = (params.page - 1) * params.pageSize;
    items = items.slice(start, start + params.pageSize);
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

  async update(id: string, _organizationId: string, _data: any): Promise<Consultation> {
    const existing = this.consultations.get(id);
    if (!existing) throw new Error('Not found');
    return existing;
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

  async searchLogs(_params: any): Promise<{ items: Consultation[]; total: number }> {
    return { items: [], total: 0 };
  }
}

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
  async removeImportedBatch(_batchId: string, _organizationId: string): Promise<number> {
    return 0;
  }
}

describe('CreateConsultationUseCase', () => {
  let useCase: CreateConsultationUseCase;
  let consultationRepo: InMemoryConsultationRepository;
  let patientRepo: InMemoryPatientRepository;
  let reportQueue: { add: jest.Mock };

  const orgId = 'org-1';
  const patientId = 'patient-1';
  const physicianId = 'physician-1';
  const userId = 'user-1';

  beforeEach(() => {
    consultationRepo = new InMemoryConsultationRepository();
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

    useCase = new CreateConsultationUseCase(consultationRepo, patientRepo, reportQueue);
  });

  const validCommand = {
    organizationId: orgId,
    patientId,
    date: new Date(),
    type: 'FIRST_VISIT' as const,
    physicianId,
    chiefComplaint: 'Dolor de oído derecho',
    createdBy: userId,
  };

  it('should create consultation successfully', async () => {
    const result = await useCase.execute(validCommand);

    expect(result.consultation).toBeDefined();
    expect(result.consultation.chiefComplaint).toBe('Dolor de oído derecho');
    expect(result.consultation.patientId).toBe(patientId);
    expect(result.firstVisitWarning).toBe(false);
  });

  it('should throw PatientNotActiveError for soft-deleted patient', async () => {
    // Replace patient with soft-deleted one
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
    useCase = new CreateConsultationUseCase(consultationRepo, patientRepo, reportQueue);

    await expect(useCase.execute(validCommand)).rejects.toThrow(PatientNotActiveError);
  });

  it('should throw PatientNotActiveError for non-existent patient', async () => {
    await expect(
      useCase.execute({ ...validCommand, patientId: 'nonexistent' }),
    ).rejects.toThrow(PatientNotActiveError);
  });

  it('should throw DateInFutureError for date > 24h in future', async () => {
    const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    await expect(
      useCase.execute({ ...validCommand, date: futureDate }),
    ).rejects.toThrow(DateInFutureError);
  });

  it('should throw InvalidDiagnosisCodeError for invalid codes', async () => {
    await expect(
      useCase.execute({
        ...validCommand,
        diagnosisCodes: [{ system: 'ICD10', code: 'INVALID_CODE', description: 'Fake', type: 'primary' }],
      }),
    ).rejects.toThrow(InvalidDiagnosisCodeError);
  });

  it('should return firstVisitWarning=true for duplicate FIRST_VISIT', async () => {
    // Create first consultation
    await useCase.execute(validCommand);

    // Create second FIRST_VISIT for same patient
    const result = await useCase.execute(validCommand);

    expect(result.firstVisitWarning).toBe(true);
  });

  it('should enqueue BullMQ job when generateReport=true', async () => {
    await useCase.execute({ ...validCommand, generateReport: true });

    expect(reportQueue.add).toHaveBeenCalledWith('generate', expect.objectContaining({
      patientId,
      organizationId: orgId,
    }));
  });

  it('should NOT enqueue when generateReport=false', async () => {
    await useCase.execute({ ...validCommand, generateReport: false });

    expect(reportQueue.add).not.toHaveBeenCalled();
  });

  it('should NOT enqueue when generateReport is undefined', async () => {
    await useCase.execute(validCommand);

    expect(reportQueue.add).not.toHaveBeenCalled();
  });

  it('should accept date within 24h future', async () => {
    const nearFuture = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12h

    const result = await useCase.execute({ ...validCommand, date: nearFuture });

    expect(result.consultation).toBeDefined();
  });

  it('should throw for more than 1 primary diagnosis', async () => {
    await expect(
      useCase.execute({
        ...validCommand,
        diagnosisCodes: [
          { system: 'ICD10' as const, code: 'J01.90', description: 'Acute sinusitis', type: 'primary' },
          { system: 'ICD10' as const, code: 'J01.90', description: 'Acute sinusitis', type: 'primary' },
        ],
      }),
    ).rejects.toThrow(InvalidDiagnosisCodeError);
  });

  it('should throw InvalidProcedureCodeError for invalid procedure codes', async () => {
    await expect(
      useCase.execute({
        ...validCommand,
        procedureCodes: [{ system: 'SNOMED' as const, code: 'INVALID_PROC', description: 'Fake procedure' }],
      }),
    ).rejects.toThrow(InvalidProcedureCodeError);
  });

  it('should accept consultation without procedure codes', async () => {
    const result = await useCase.execute(validCommand);
    expect(result.consultation).toBeDefined();
    expect(result.consultation.procedureCodes).toEqual([]);
  });

  it('should throw InvalidProcedureCodeError listing multiple invalid codes', async () => {
    try {
      await useCase.execute({
        ...validCommand,
        procedureCodes: [
          { system: 'SNOMED' as const, code: 'FAKE1', description: 'Fake 1' },
          { system: 'SNOMED' as const, code: 'FAKE2', description: 'Fake 2' },
        ],
      });
      fail('Should have thrown InvalidProcedureCodeError');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidProcedureCodeError);
      expect((error as InvalidProcedureCodeError).invalidCodes).toContain('FAKE1');
      expect((error as InvalidProcedureCodeError).invalidCodes).toContain('FAKE2');
    }
  });
});
