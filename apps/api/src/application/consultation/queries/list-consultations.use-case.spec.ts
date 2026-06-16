// apps/api/src/application/consultation/queries/list-consultations.use-case.spec.ts
import { ListConsultationsUseCase } from './list-consultations.use-case';
import type { IConsultationRepository, CreateConsultationInput, UpdateConsultationInput, ListConsultationsParams } from '@/domain/consultation/consultation.repository.interface';
import type { Consultation } from '@/domain/consultation/consultation.entity';
import { Consultation as ConsultationEntity } from '@/domain/consultation/consultation.entity';

class InMemoryConsultationRepository implements IConsultationRepository {
  private consultations: ConsultationEntity[] = [];
  private counter = 0;

  async findById(id: string, _organizationId: string): Promise<Consultation | null> {
    const c = this.consultations.find((c) => c.id === id && !c.deletedAt);
    return c ?? null;
  }

  async findByPatientId(patientId: string, _organizationId: string): Promise<Consultation[]> {
    return this.consultations.filter((c) => c.patientId === patientId && !c.deletedAt);
  }

  async listByPatient(patientId: string, organizationId: string, params: ListConsultationsParams): Promise<{ items: Consultation[]; total: number }> {
    let items = this.consultations.filter(
      (c) => c.patientId === patientId && c.organizationId === organizationId && !c.deletedAt,
    );

    // Type filter
    if (params.type) {
      items = items.filter((c) => c.type === params.type);
    }

    // Date range filter
    if (params.from) {
      items = items.filter((c) => c.date >= params.from!);
    }
    if (params.to) {
      items = items.filter((c) => c.date <= params.to!);
    }

    const total = items.length;

    // Sort
    items.sort((a, b) => {
      const aVal = a[params.sortBy];
      const bVal = b[params.sortBy];
      if (aVal instanceof Date && bVal instanceof Date) {
        return params.sortOrder === 'asc' ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime();
      }
      return 0;
    });

    // Paginate
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
    this.consultations.push(consultation);
    return consultation;
  }

  async update(id: string, _organizationId: string, _data: UpdateConsultationInput): Promise<Consultation> {
    const idx = this.consultations.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Not found');
    return this.consultations[idx];
  }

  async softDelete(id: string, _organizationId: string): Promise<Consultation> {
    const idx = this.consultations.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Not found');
    const deleted = this.consultations[idx].softDelete();
    this.consultations[idx] = deleted;
    return deleted;
  }

  async existsFirstVisitForPatient(patientId: string, _organizationId: string): Promise<boolean> {
    return this.consultations.some(
      (c) => c.patientId === patientId && c.type === 'FIRST_VISIT' && !c.deletedAt,
    );
  }

  async searchLogs(_params: any): Promise<{ items: Consultation[]; total: number }> {
    return { items: [], total: 0 };
  }
}

describe('ListConsultationsUseCase', () => {
  let useCase: ListConsultationsUseCase;
  let repo: InMemoryConsultationRepository;

  const orgId = 'org-1';
  const patientId = 'patient-1';
  const userId = 'user-1';

  beforeEach(() => {
    repo = new InMemoryConsultationRepository();
    useCase = new ListConsultationsUseCase(repo);
  });

  async function seedConsultations(count: number, typeOverride?: string): Promise<void> {
    for (let i = 0; i < count; i++) {
      await repo.create({
        patientId,
        organizationId: orgId,
        date: new Date(2026, 0, i + 1),
        type: (typeOverride ?? (i % 2 === 0 ? 'FIRST_VISIT' : 'FOLLOW_UP')) as any,
        physicianId: 'physician-1',
        chiefComplaint: `Complaint ${i + 1}`,
        createdBy: userId,
      });
    }
  }

  it('should return paginated list for a patient', async () => {
    await seedConsultations(5);

    const result = await useCase.execute({
      patientId,
      organizationId: orgId,
      page: 1,
      pageSize: 3,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(5);
    expect(result.totalPages).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(3);
  });

  it('should return second page correctly', async () => {
    await seedConsultations(5);

    const result = await useCase.execute({
      patientId,
      organizationId: orgId,
      page: 2,
      pageSize: 3,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(5);
  });

  it('should filter by type', async () => {
    await seedConsultations(4);

    const result = await useCase.execute({
      patientId,
      organizationId: orgId,
      page: 1,
      pageSize: 10,
      type: 'FIRST_VISIT',
      sortBy: 'date',
      sortOrder: 'desc',
    });

    expect(result.items.every((i) => i.type === 'FIRST_VISIT')).toBe(true);
  });

  it('should filter by date range', async () => {
    await seedConsultations(5);

    const result = await useCase.execute({
      patientId,
      organizationId: orgId,
      page: 1,
      pageSize: 10,
      from: new Date('2026-01-02'),
      to: new Date('2026-01-04'),
      sortBy: 'date',
      sortOrder: 'asc',
    });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.length).toBeLessThan(5);
  });

  it('should return empty list for no consultations', async () => {
    const result = await useCase.execute({
      patientId,
      organizationId: orgId,
      page: 1,
      pageSize: 10,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });
});
