// apps/api/src/application/allergy/commands/create-allergy.use-case.spec.ts
import { CreateAllergyUseCase } from './create-allergy.use-case';
import { InMemoryAllergyRepository } from './in-memory-allergy.repository';
import { InMemoryPatientRepository } from '@/infrastructure/database/repositories/in-memory-patient.repository';
import { Patient } from '@/domain/patient/patient.entity';

describe('CreateAllergyUseCase', () => {
  let useCase: CreateAllergyUseCase;
  let allergyRepo: InMemoryAllergyRepository;
  let patientRepo: InMemoryPatientRepository;

  const orgId = 'org-1';
  const userId = 'user-1';

  beforeEach(() => {
    allergyRepo = new InMemoryAllergyRepository();
    patientRepo = new InMemoryPatientRepository();
    useCase = new CreateAllergyUseCase(allergyRepo, patientRepo);
  });

  async function seedPatient(): Promise<Patient> {
    return patientRepo.create({
      nhc: await patientRepo.getNextNhcSequence(orgId),
      firstName: 'María',
      lastName: 'García López',
      birthDate: new Date('1984-03-12'),
      sex: 'FEMALE',
      organizationId: orgId,
      createdBy: userId,
    });
  }

  it('should add allergy to patient', async () => {
    const patient = await seedPatient();

    const result = await useCase.execute({
      patientId: patient.id,
      organizationId: orgId,
      substance: 'Penicilina',
      severity: 'SEVERE',
      status: 'ACTIVE',
      createdBy: userId,
    });

    expect(result.substance).toBe('Penicilina');
    expect(result.severity).toBe('SEVERE');
    expect(result.status).toBe('ACTIVE');
    expect(result.patientId).toBe(patient.id);
    expect(result.organizationId).toBe(orgId);
  });

  it('should reject ANAPHYLAXIS allergy without explicit confirmation', async () => {
    const patient = await seedPatient();

    await expect(
      useCase.execute({
        patientId: patient.id,
        organizationId: orgId,
        substance: 'Látex',
        severity: 'ANAPHYLAXIS',
        status: 'ACTIVE',
        createdBy: userId,
        // confirmAnaphylaxis NOT set
      }),
    ).rejects.toThrow('ANAPHYLAXIS allergy requires explicit confirmation');
  });

  it('should create ANAPHYLAXIS allergy when confirmed', async () => {
    const patient = await seedPatient();

    const result = await useCase.execute({
      patientId: patient.id,
      organizationId: orgId,
      substance: 'Látex',
      severity: 'ANAPHYLAXIS',
      status: 'ACTIVE',
      createdBy: userId,
      confirmAnaphylaxis: true,
    });

    expect(result.severity).toBe('ANAPHYLAXIS');
  });

  it('should throw error for nonexistent patient', async () => {
    await expect(
      useCase.execute({
        patientId: 'nonexistent',
        organizationId: orgId,
        substance: 'Penicilina',
        severity: 'MILD',
        createdBy: userId,
      }),
    ).rejects.toThrow('Patient not found');
  });

  it('should default status to ACTIVE when not provided', async () => {
    const patient = await seedPatient();

    const result = await useCase.execute({
      patientId: patient.id,
      organizationId: orgId,
      substance: 'Polvo',
      severity: 'MILD',
      createdBy: userId,
    });

    expect(result.status).toBe('ACTIVE');
  });
});