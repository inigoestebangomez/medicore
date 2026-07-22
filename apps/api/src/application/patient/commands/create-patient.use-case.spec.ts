// apps/api/src/application/patient/commands/create-patient.use-case.spec.ts
import { CreatePatientUseCase } from './create-patient.use-case';
import { InMemoryPatientRepository } from '@/infrastructure/database/repositories/in-memory-patient.repository';
import { DuplicatePatientError } from '@/domain/patient/errors/duplicate-patient.error';
import { DuplicateNhcError } from '@/domain/patient/errors/duplicate-nhc.error';

describe('CreatePatientUseCase', () => {
  let useCase: CreatePatientUseCase;
  let repo: InMemoryPatientRepository;

  const orgId = 'org-1';
  const userId = 'user-1';

  beforeEach(() => {
    repo = new InMemoryPatientRepository();
    useCase = new CreatePatientUseCase(repo);
  });

  const validInput = {
    firstName: 'María',
    lastName: 'García López',
    birthDate: '1984-03-12',
    sex: 'FEMALE' as const,
    phone: '+34612345678',
    email: 'maria@example.com',
    idDocument: '12345678A',
    idDocType: 'DNI' as const,
    bloodType: 'A_POS' as const,
    notes: 'Patient notes',
    organizationId: orgId,
    createdBy: userId,
  };

  describe('BR-PAT-001: NHC auto-generation', () => {
    it('should generate sequential NHC if not provided', async () => {
      const result = await useCase.execute(validInput);

      expect(result.nhc).toMatch(/^\d{4}-\d{5}$/);
      // NHC should contain current year
      const year = new Date().getFullYear().toString();
      expect(result.nhc).toContain(year);
    });

    it('should increment NHC sequence for subsequent patients', async () => {
      const first = await useCase.execute(validInput);
      const second = await useCase.execute({ ...validInput, firstName: 'Juan', lastName: 'Pérez' });

      const seq1 = parseInt(first.nhc.split('-')[1], 10);
      const seq2 = parseInt(second.nhc.split('-')[1], 10);
      expect(seq2).toBeGreaterThan(seq1);
    });

    it('should accept valid external NHC format', async () => {
      const result = await useCase.execute({ ...validInput, nhc: '2026-00042' });

      expect(result.nhc).toBe('2026-00042');
    });

    it('should reject external NHC with invalid format', async () => {
      await expect(
        useCase.execute({ ...validInput, nhc: 'invalid-nhc' }),
      ).rejects.toThrow(DuplicateNhcError);
    });
  });

  describe('BR-PAT-002: Duplicate detection', () => {
    it('should detect duplicates by lastName + birthDate', async () => {
      await useCase.execute(validInput);

      await expect(
        useCase.execute({ ...validInput, confirmDuplicate: false }),
      ).rejects.toThrow(DuplicatePatientError);
    });

    it('should create patient when confirmDuplicate is true despite duplicates', async () => {
      await useCase.execute(validInput);

      // Second patient with same lastName + birthDate but confirmed
      const result = await useCase.execute({ ...validInput, confirmDuplicate: true, nhc: undefined });
      expect(result).toBeDefined();
      expect(result.lastName).toBe('García López');
    });

    it('should reject patient if confirmDuplicate is false and duplicates exist', async () => {
      await useCase.execute(validInput);

      await expect(
        useCase.execute({ ...validInput, confirmDuplicate: false }),
      ).rejects.toThrow(DuplicatePatientError);
    });

    it('should not flag duplicates across different organizations', async () => {
      await useCase.execute(validInput);

      // Same name, different org — should NOT be duplicate
      const result = await useCase.execute({
        ...validInput,
        organizationId: 'org-2',
      });
      expect(result).toBeDefined();
    });

    it('should include similar patients in DuplicatePatientError', async () => {
      await useCase.execute(validInput);

      try {
        await useCase.execute({ ...validInput, confirmDuplicate: false });
        fail('Should have thrown DuplicatePatientError');
      } catch (error) {
        expect(error).toBeInstanceOf(DuplicatePatientError);
        const dupError = error as DuplicatePatientError;
        expect(dupError.similarPatients).toHaveLength(1);
        expect(dupError.similarPatients[0].lastName).toBe('García López');
      }
    });
  });

  describe('basic creation', () => {
    it('should create a patient with all fields', async () => {
      const result = await useCase.execute(validInput);

      expect(result.id).toBeDefined();
      expect(result.firstName).toBe('María');
      expect(result.lastName).toBe('García López');
      expect(result.sex).toBe('FEMALE');
      expect(result.organizationId).toBe(orgId);
      expect(result.createdBy).toBe(userId);
    });

    it('should set default values for optional fields', async () => {
      const result = await useCase.execute({
        firstName: 'Juan',
        lastName: 'Martínez',
        birthDate: '1990-01-15',
        sex: 'MALE',
        organizationId: orgId,
        createdBy: userId,
      });

      expect(result.phone).toBeNull();
      expect(result.email).toBeNull();
      expect(result.idDocument).toBeNull();
      expect(result.idDocType).toBe('DNI');
      expect(result.bloodType).toBe('UNKNOWN');
    });
  });

  describe('name normalization (SDD import-data-quality)', () => {
    it('should title-case the first and last name on manual creation', async () => {
      const result = await useCase.execute({
        ...validInput,
        firstName: 'MARÍA ELENA',
        lastName: 'GARCÍA-LÓPEZ',
      });

      expect(result.firstName).toBe('María Elena');
      expect(result.lastName).toBe('García-López');
    });

    it('should accept a null birthDate and skip duplicate detection', async () => {
      const first = await useCase.execute({
        ...validInput,
        firstName: 'Juan',
        lastName: 'Pérez',
        birthDate: null as unknown as string,
      });
      expect(first.birthDate).toBeNull();

      // Same lastName, no birthDate — duplicate detection is skipped because
      // there is no DOB to match on, so a second patient is created (not flagged).
      const second = await useCase.execute({
        ...validInput,
        firstName: 'Pedro',
        lastName: 'Pérez',
        birthDate: null as unknown as string,
      });
      expect(second.birthDate).toBeNull();
      expect(second.id).not.toBe(first.id);
    });
  });
});