// apps/api/src/application/consultation/queries/get-consultation.use-case.spec.ts
import { GetConsultationUseCase } from './get-consultation.use-case';
import type { IConsultationRepository, CreateConsultationInput, UpdateConsultationInput, ListConsultationsParams } from '@/domain/consultation/consultation.repository.interface';
import type { Consultation } from '@/domain/consultation/consultation.entity';
import { Consultation as ConsultationEntity } from '@/domain/consultation/consultation.entity';
import { ConsultationNotFoundError } from '@/domain/consultation/errors/consultation-not-found.error';

class InMemoryConsultationRepository implements IConsultationRepository {
  private consultations: Map<string, ConsultationEntity> = new Map();
  private counter = 0;

  async findById(id: string, _organizationId: string): Promise<Consultation | null> {
    const c = this.consultations.get(id);
    if (!c || c.deletedAt) return null;
    return c;
  }

  async findByPatientId(_patientId: string, _organizationId: string): Promise<Consultation[]> {
    return [];
  }

  async listByPatient(_patientId: string, _organizationId: string, _params: ListConsultationsParams): Promise<{ items: Consultation[]; total: number }> {
    return { items: [], total: 0 };
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

  async update(id: string, _organizationId: string, _data: UpdateConsultationInput): Promise<Consultation> {
    const existing = this.consultations.get(id);
    if (!existing) throw new ConsultationNotFoundError(id);
    return existing;
  }

  async softDelete(id: string, _organizationId: string): Promise<Consultation> {
    const existing = this.consultations.get(id);
    if (!existing) throw new ConsultationNotFoundError(id);
    const deleted = existing.softDelete();
    this.consultations.set(id, deleted);
    return deleted;
  }

  async existsFirstVisitForPatient(_patientId: string, _organizationId: string): Promise<boolean> {
    return false;
  }

  async searchLogs(_params: any): Promise<{ items: Consultation[]; total: number }> {
    return { items: [], total: 0 };
  }
}

describe('GetConsultationUseCase', () => {
  let useCase: GetConsultationUseCase;
  let repo: InMemoryConsultationRepository;

  const orgId = 'org-1';

  beforeEach(() => {
    repo = new InMemoryConsultationRepository();
    useCase = new GetConsultationUseCase(repo);
  });

  it('should return consultation when found', async () => {
    const created = await repo.create({
      patientId: 'patient-1',
      organizationId: orgId,
      date: new Date(),
      type: 'FIRST_VISIT',
      physicianId: 'physician-1',
      chiefComplaint: 'Dolor de oído',
      createdBy: 'user-1',
    });

    const result = await useCase.execute({
      id: created.id,
      organizationId: orgId,
    });

    expect(result).toBeDefined();
    expect(result.id).toBe(created.id);
    expect(result.chiefComplaint).toBe('Dolor de oído');
  });

  it('should throw ConsultationNotFoundError when not found', async () => {
    await expect(
      useCase.execute({ id: 'nonexistent', organizationId: orgId }),
    ).rejects.toThrow(ConsultationNotFoundError);
  });
});
