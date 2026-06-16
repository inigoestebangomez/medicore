// apps/api/src/application/allergy/queries/get-allergy.use-case.spec.ts
import { GetAllergyUseCase } from './get-allergy.use-case';
import { InMemoryAllergyRepository } from '../commands/in-memory-allergy.repository';
import { InMemoryPatientRepository } from '@/infrastructure/database/repositories/in-memory-patient.repository';
import { Patient } from '@/domain/patient/patient.entity';

describe('GetAllergyUseCase', () => {
  let useCase: GetAllergyUseCase;
  let allergyRepo: InMemoryAllergyRepository;
  let patientRepo: InMemoryPatientRepository;

  const orgId = 'org-1';
  const userId = 'user-1';

  beforeEach(() => {
    allergyRepo = new InMemoryAllergyRepository();
    patientRepo = new InMemoryPatientRepository();
    useCase = new GetAllergyUseCase(allergyRepo);
  });

  async function seedPatient(): Promise<Patient> {
    return patientRepo.create({
      nhc: await patientRepo.getNextNhcSequence(orgId),
      firstName: 'María',
      lastName: 'García',
      birthDate: new Date('1984-03-12'),
      sex: 'FEMALE',
      organizationId: orgId,
      createdBy: userId,
    });
  }

  it('should get allergies for a patient', async () => {
    const patient = await seedPatient();

    await allergyRepo.create({
      patientId: patient.id,
      organizationId: orgId,
      substance: 'Penicilina',
      severity: 'SEVERE',
      status: 'ACTIVE',
      createdBy: userId,
    });

    await allergyRepo.create({
      patientId: patient.id,
      organizationId: orgId,
      substance: 'Polvo',
      severity: 'MILD',
      status: 'ACTIVE',
      createdBy: userId,
    });

    const result = await useCase.execute({
      patientId: patient.id,
      organizationId: orgId,
    });

    expect(result).toHaveLength(2);
    expect(result[0].substance).toBe('Penicilina');
    expect(result[1].substance).toBe('Polvo');
  });

  it('should return empty array if no allergies', async () => {
    const patient = await seedPatient();

    const result = await useCase.execute({
      patientId: patient.id,
      organizationId: orgId,
    });

    expect(result).toHaveLength(0);
  });
});