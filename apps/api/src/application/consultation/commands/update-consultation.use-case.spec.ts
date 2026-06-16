// apps/api/src/application/consultation/commands/update-consultation.use-case.spec.ts
import { UpdateConsultationUseCase, ForbiddenError } from './update-consultation.use-case';
import type { IConsultationRepository, CreateConsultationInput, UpdateConsultationInput, ListConsultationsParams } from '@/domain/consultation/consultation.repository.interface';
import type { Consultation } from '@/domain/consultation/consultation.entity';
import { Consultation as ConsultationEntity } from '@/domain/consultation/consultation.entity';
import { ConsultationNotFoundError } from '@/domain/consultation/errors/consultation-not-found.error';
import { InvalidDiagnosisCodeError } from '@/domain/consultation/errors/invalid-diagnosis-code.error';
import { InvalidProcedureCodeError } from '@/domain/consultation/errors/invalid-procedure-code.error';

class InMemoryConsultationRepository implements IConsultationRepository {
  private consultations: Map<string, ConsultationEntity> = new Map();
  private counter = 0;
  private auditLogs: Map<string, any[]> = new Map();

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
    this.auditLogs.set(id, []);
    return consultation;
  }

  async update(id: string, _organizationId: string, data: UpdateConsultationInput): Promise<Consultation> {
    const existing = this.consultations.get(id);
    if (!existing) throw new ConsultationNotFoundError(id);

    const updated = new ConsultationEntity({
      ...existing,
      ...Object.fromEntries(
        Object.entries(data).filter(([k, v]) => k !== 'auditLog' && v !== undefined),
      ),
      updatedAt: new Date(),
    });
    this.consultations.set(id, updated);

    if (data.auditLog) {
      const logs = this.auditLogs.get(id) ?? [];
      logs.push(data.auditLog);
      this.auditLogs.set(id, logs);
    }

    return updated;
  }

  async softDelete(id: string, _organizationId: string): Promise<Consultation> {
    const existing = this.consultations.get(id);
    if (!existing) throw new ConsultationNotFoundError(id);
    const deleted = existing.softDelete();
    this.consultations.set(id, deleted);
    return deleted;
  }

  async existsFirstVisitForPatient(patientId: string, _organizationId: string): Promise<boolean> {
    return Array.from(this.consultations.values()).some(
      (c) => c.patientId === patientId && c.type === 'FIRST_VISIT' && !c.deletedAt,
    );
  }

  getAuditLogs(id: string): any[] {
    return this.auditLogs.get(id) ?? [];
  }

  async searchLogs(_params: any): Promise<{ items: Consultation[]; total: number }> {
    return { items: [], total: 0 };
  }
}

describe('UpdateConsultationUseCase', () => {
  let useCase: UpdateConsultationUseCase;
  let repo: InMemoryConsultationRepository;

  const orgId = 'org-1';
  const patientId = 'patient-1';
  const physicianId = 'physician-1';
  const userId = 'user-1';
  const otherUserId = 'user-2';

  beforeEach(() => {
    repo = new InMemoryConsultationRepository();
    useCase = new UpdateConsultationUseCase(repo);
  });

  async function seedConsultation(overrides: Record<string, unknown> = {}): Promise<Consultation> {
    return repo.create({
      patientId,
      organizationId: orgId,
      date: new Date(),
      type: 'FIRST_VISIT',
      physicianId,
      chiefComplaint: 'Dolor de oído',
      createdBy: userId,
      ...overrides,
    });
  }

  it('should update consultation successfully', async () => {
    const consultation = await seedConsultation();

    const result = await useCase.execute({
      id: consultation.id,
      organizationId: orgId,
      role: 'OWNER',
      userId,
      chiefComplaint: 'Dolor de oído izquierdo',
    });

    expect(result.chiefComplaint).toBe('Dolor de oído izquierdo');
  });

  it('should throw ConsultationNotFoundError for missing ID', async () => {
    await expect(
      useCase.execute({
        id: 'nonexistent',
        organizationId: orgId,
        role: 'OWNER',
        userId,
        chiefComplaint: 'Updated',
      }),
    ).rejects.toThrow(ConsultationNotFoundError);
  });

  it('should throw ForbiddenError when PHYSICIAN tries to update another\'s consultation', async () => {
    const consultation = await seedConsultation();

    await expect(
      useCase.execute({
        id: consultation.id,
        organizationId: orgId,
        role: 'PHYSICIAN',
        userId: otherUserId,
        chiefComplaint: 'Trying to update',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('should allow OWNER to update any consultation', async () => {
    const consultation = await seedConsultation();

    const result = await useCase.execute({
      id: consultation.id,
      organizationId: orgId,
      role: 'OWNER',
      userId: otherUserId,
      chiefComplaint: 'Owner update',
    });

    expect(result.chiefComplaint).toBe('Owner update');
  });

  it('should allow PHYSICIAN to update own consultation', async () => {
    const consultation = await seedConsultation();

    const result = await useCase.execute({
      id: consultation.id,
      organizationId: orgId,
      role: 'PHYSICIAN',
      userId,
      chiefComplaint: 'Own update',
    });

    expect(result.chiefComplaint).toBe('Own update');
  });

  it('should create audit log entry only for changed fields', async () => {
    const consultation = await seedConsultation();

    await useCase.execute({
      id: consultation.id,
      organizationId: orgId,
      role: 'OWNER',
      userId,
      chiefComplaint: 'New complaint',
    });

    const logs = repo.getAuditLogs(consultation.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('UPDATE');
    expect(logs[0].details).toContain('chiefComplaint');
    expect(logs[0].performedBy).toBe(userId);
  });

  it('should not create audit log when no fields changed', async () => {
    const consultation = await seedConsultation();

    await useCase.execute({
      id: consultation.id,
      organizationId: orgId,
      role: 'OWNER',
      userId,
    });

    const logs = repo.getAuditLogs(consultation.id);
    expect(logs).toHaveLength(0);
  });

  it('should throw InvalidDiagnosisCodeError for invalid codes on update', async () => {
    const consultation = await seedConsultation();

    await expect(
      useCase.execute({
        id: consultation.id,
        organizationId: orgId,
        role: 'OWNER',
        userId,
        diagnosisCodes: [{ system: 'ICD10', code: 'INVALID', description: 'Fake', type: 'primary' }],
      }),
    ).rejects.toThrow(InvalidDiagnosisCodeError);
  });

  it('should throw InvalidProcedureCodeError for invalid procedure codes on update', async () => {
    const consultation = await seedConsultation();

    await expect(
      useCase.execute({
        id: consultation.id,
        organizationId: orgId,
        role: 'OWNER',
        userId,
        procedureCodes: [{ system: 'SNOMED', code: 'FAKE_PROC', description: 'Fake procedure' }],
      }),
    ).rejects.toThrow(InvalidProcedureCodeError);
  });

  it('should list multiple invalid procedure codes in error', async () => {
    const consultation = await seedConsultation();

    try {
      await useCase.execute({
        id: consultation.id,
        organizationId: orgId,
        role: 'OWNER',
        userId,
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
});
