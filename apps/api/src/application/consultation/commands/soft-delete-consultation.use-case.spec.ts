// apps/api/src/application/consultation/commands/soft-delete-consultation.use-case.spec.ts
import { SoftDeleteConsultationUseCase } from './soft-delete-consultation.use-case';
import { ForbiddenError } from './update-consultation.use-case';
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

  async findByPatientId(patientId: string, _organizationId: string): Promise<Consultation[]> {
    return Array.from(this.consultations.values()).filter(
      (c) => c.patientId === patientId,
    );
  }

  async listByPatient(patientId: string, organizationId: string, params: ListConsultationsParams): Promise<{ items: Consultation[]; total: number }> {
    let items = Array.from(this.consultations.values()).filter(
      (c) => c.patientId === patientId && c.organizationId === organizationId,
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

  async update(id: string, _organizationId: string, data: UpdateConsultationInput): Promise<Consultation> {
    const existing = this.consultations.get(id);
    if (!existing) throw new ConsultationNotFoundError(id);
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

  async searchLogs(_params: any): Promise<{ items: Consultation[]; total: number }> {
    return { items: [], total: 0 };
  }
}

describe('SoftDeleteConsultationUseCase', () => {
  let useCase: SoftDeleteConsultationUseCase;
  let repo: InMemoryConsultationRepository;

  const orgId = 'org-1';
  const patientId = 'patient-1';
  const physicianId = 'physician-1';
  const userId = 'user-1';
  const otherUserId = 'user-2';

  beforeEach(() => {
    repo = new InMemoryConsultationRepository();
    useCase = new SoftDeleteConsultationUseCase(repo);
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

  it('should soft-delete consultation successfully', async () => {
    const consultation = await seedConsultation();

    const result = await useCase.execute({
      id: consultation.id,
      organizationId: orgId,
      role: 'OWNER',
      userId,
    });

    expect(result.deletedAt).not.toBeNull();
  });

  it('should throw ConsultationNotFoundError for missing ID', async () => {
    await expect(
      useCase.execute({
        id: 'nonexistent',
        organizationId: orgId,
        role: 'OWNER',
        userId,
      }),
    ).rejects.toThrow(ConsultationNotFoundError);
  });

  it('should allow PHYSICIAN to delete own consultation', async () => {
    const consultation = await seedConsultation();

    const result = await useCase.execute({
      id: consultation.id,
      organizationId: orgId,
      role: 'PHYSICIAN',
      userId,
    });

    expect(result.deletedAt).not.toBeNull();
  });

  it('should throw ForbiddenError when PHYSICIAN deletes another\'s consultation', async () => {
    const consultation = await seedConsultation();

    await expect(
      useCase.execute({
        id: consultation.id,
        organizationId: orgId,
        role: 'PHYSICIAN',
        userId: otherUserId,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('should allow OWNER to delete any consultation', async () => {
    const consultation = await seedConsultation();

    const result = await useCase.execute({
      id: consultation.id,
      organizationId: orgId,
      role: 'OWNER',
      userId: otherUserId,
    });

    expect(result.deletedAt).not.toBeNull();
  });
});
