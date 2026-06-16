// apps/api/src/application/allergy/commands/update-allergy.use-case.spec.ts
import { UpdateAllergyUseCase } from './update-allergy.use-case';
import { InMemoryAllergyRepository } from './in-memory-allergy.repository';
import { InMemoryPatientRepository } from '@/infrastructure/database/repositories/in-memory-patient.repository';
import { Patient } from '@/domain/patient/patient.entity';

describe('UpdateAllergyUseCase', () => {
  let useCase: UpdateAllergyUseCase;
  let allergyRepo: InMemoryAllergyRepository;
  let patientRepo: InMemoryPatientRepository;

  const orgId = 'org-1';
  const userId = 'user-1';

  beforeEach(() => {
    allergyRepo = new InMemoryAllergyRepository();
    patientRepo = new InMemoryPatientRepository();
    useCase = new UpdateAllergyUseCase(allergyRepo);
  });

  async function seedPatientAndAllergy(): Promise<{ patient: Patient; allergyId: string }> {
    const patient = await patientRepo.create({
      nhc: await patientRepo.getNextNhcSequence(orgId),
      firstName: 'María',
      lastName: 'García',
      birthDate: new Date('1984-03-12'),
      sex: 'FEMALE',
      organizationId: orgId,
      createdBy: userId,
    });

    const allergy = await allergyRepo.create({
      patientId: patient.id,
      organizationId: orgId,
      substance: 'Penicilina',
      severity: 'SEVERE',
      status: 'ACTIVE',
      createdBy: userId,
    });

    return { patient, allergyId: allergy.id };
  }

  it('should update allergy status', async () => {
    const { allergyId } = await seedPatientAndAllergy();

    const result = await useCase.execute({
      id: allergyId,
      organizationId: orgId,
      status: 'INACTIVE',
    });

    expect(result.status).toBe('INACTIVE');
  });

  it('should update allergy substance', async () => {
    const { allergyId } = await seedPatientAndAllergy();

    const result = await useCase.execute({
      id: allergyId,
      organizationId: orgId,
      substance: 'Amoxicilina',
    });

    expect(result.substance).toBe('Amoxicilina');
  });

  it('should throw error for nonexistent allergy', async () => {
    await expect(
      useCase.execute({
        id: 'nonexistent',
        organizationId: orgId,
        status: 'INACTIVE',
      }),
    ).rejects.toThrow('Allergy not found');
  });

  it('should reject updating severity to ANAPHYLAXIS without confirmation', async () => {
    const { allergyId } = await seedPatientAndAllergy();

    await expect(
      useCase.execute({
        id: allergyId,
        organizationId: orgId,
        severity: 'ANAPHYLAXIS',
      }),
    ).rejects.toThrow('ANAPHYLAXIS allergy requires explicit confirmation');
  });

  it('should allow updating severity to ANAPHYLAXIS with confirmation', async () => {
    const { allergyId } = await seedPatientAndAllergy();

    const result = await useCase.execute({
      id: allergyId,
      organizationId: orgId,
      severity: 'ANAPHYLAXIS',
      confirmAnaphylaxis: true,
    });

    expect(result.severity).toBe('ANAPHYLAXIS');
  });
});