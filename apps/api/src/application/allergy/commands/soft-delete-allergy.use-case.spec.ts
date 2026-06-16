// apps/api/src/application/allergy/commands/soft-delete-allergy.use-case.spec.ts
import { SoftDeleteAllergyUseCase } from './soft-delete-allergy.use-case';
import { InMemoryAllergyRepository } from './in-memory-allergy.repository';
import { InMemoryPatientRepository } from '@/infrastructure/database/repositories/in-memory-patient.repository';
import { Patient } from '@/domain/patient/patient.entity';

describe('SoftDeleteAllergyUseCase', () => {
  let useCase: SoftDeleteAllergyUseCase;
  let allergyRepo: InMemoryAllergyRepository;
  let patientRepo: InMemoryPatientRepository;

  const orgId = 'org-1';
  const userId = 'user-1';

  beforeEach(() => {
    allergyRepo = new InMemoryAllergyRepository();
    patientRepo = new InMemoryPatientRepository();
    useCase = new SoftDeleteAllergyUseCase(allergyRepo);
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

  it('should soft-delete an allergy successfully', async () => {
    const { allergyId } = await seedPatientAndAllergy();

    const result = await useCase.execute({
      id: allergyId,
      organizationId: orgId,
    });

    expect(result.deletedAt).not.toBeNull();

    // Verify it's no longer findable
    const found = await allergyRepo.findById(allergyId, orgId);
    expect(found).toBeNull();
  });

  it('should throw when allergy not found', async () => {
    await expect(
      useCase.execute({
        id: 'nonexistent',
        organizationId: orgId,
      }),
    ).rejects.toThrow('Allergy not found');
  });
});
