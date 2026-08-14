// apps/api/src/api/patients/patients.controller.spec.ts
import { PatientsController } from './patients.controller';
import { InMemoryPatientRepository } from '@/infrastructure/database/repositories/in-memory-patient.repository';
import { InMemoryAllergyRepository } from '@/application/allergy/commands/in-memory-allergy.repository';
import type { JwtPayload } from '@medicore/contracts';
import { Patient } from '@/domain/patient/patient.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('PatientsController', () => {
  let controller: PatientsController;
  let patientRepo: InMemoryPatientRepository;
  let allergyRepo: InMemoryAllergyRepository;

  const orgId = 'org-1';
  const userId = 'user-1';

  const physicianUser: JwtPayload = {
    sub: userId,
    email: 'physician@test.com',
    name: 'Dr. Test',
    organizationId: orgId,
    role: 'PHYSICIAN',
    iat: 1718000000,
    exp: 1718600000,
  };

  const viewerUser: JwtPayload = {
    sub: 'viewer-1',
    email: 'viewer@test.com',
    name: 'Viewer',
    organizationId: orgId,
    role: 'VIEWER',
    iat: 1718000000,
    exp: 1718600000,
  };

  beforeEach(() => {
    patientRepo = new InMemoryPatientRepository();
    allergyRepo = new InMemoryAllergyRepository();
    controller = new PatientsController(patientRepo as any, allergyRepo as any);
  });

  async function seedPatient(): Promise<Patient> {
    return patientRepo.create({
      nhc: await patientRepo.getNextNhcSequence(orgId),
      firstName: 'María',
      lastName: 'García López',
      birthDate: new Date('1984-03-12'),
      sex: 'FEMALE',
      phone: '+34612345678',
      email: 'maria@example.com',
      idDocument: '12345678A',
      idDocType: 'DNI',
      bloodType: 'A_POS',
      notes: 'Patient notes',
      organizationId: orgId,
      createdBy: userId,
    });
  }

  describe('POST /patients', () => {
    it('should create a patient', async () => {
      const body = {
        firstName: 'Juan',
        lastName: 'Martínez',
        birthDate: '1990-01-15',
        sex: 'MALE',
      };

      const result = await controller.create(body, undefined, physicianUser);

      expect(result.firstName).toBe('Juan');
      expect(result.lastName).toBe('Martínez');
      expect(result.nhc).toMatch(/^\d{4}-\d{5}$/);
    });

    it('should return 409 with duplicate candidates', async () => {
      await seedPatient();

      const body = {
        firstName: 'María',
        lastName: 'García López',
        birthDate: '1984-03-12',
        sex: 'FEMALE',
      };

      await expect(
        controller.create(body, undefined, physicianUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('GET /patients/:id', () => {
    it('should return patient with all fields for PHYSICIAN role', async () => {
      const patient = await seedPatient();

      const result = await controller.get(patient.id, physicianUser);

      expect(result.id).toBe(patient.id);
      expect(result.phone).toBe('+34612345678');
      expect(result.email).toBe('maria@example.com');
      expect(result.idDocument).toBe('12345678A');
    });

    it('should omit sensitive data for VIEWER role', async () => {
      const patient = await seedPatient();

      const result = await controller.get(patient.id, viewerUser);

      expect(result.id).toBe(patient.id);
      // VIEWER should not see sensitive fields
      expect(result).not.toHaveProperty('phone');
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('address');
      expect(result).not.toHaveProperty('idDocument');
      expect(result).not.toHaveProperty('emergencyContact');
    });

    it('should return 404 for nonexistent patient', async () => {
      await expect(
        controller.get('nonexistent', physicianUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /patients/:patientId/imported-events', () => {
    it('returns imported history for an authorized patient', async () => {
      const patient = await seedPatient();
      await patientRepo.enrich(patient.id, orgId, {
        importedData: { 'batch-synthetic': { diagnosis: 'synthetic diagnosis', _rowIndex: 4 } },
        importSource: 'xlsx',
      }, userId);
      const result = await controller.listImportedEvents(patient.id, undefined, undefined, physicianUser);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('import');
      expect(result.items[0].rowIndex).toBe(4);
    });

    it('does not disclose another organization patient', async () => {
      const patient = await patientRepo.create({
        nhc: '2026-00001', firstName: 'Other', lastName: 'Org', birthDate: null, sex: 'UNKNOWN',
        organizationId: 'org-2', createdBy: userId,
      });
      await expect(controller.listImportedEvents(patient.id, undefined, undefined, physicianUser)).rejects.toThrow(NotFoundException);
    });

    it('rejects an invalid cursor', async () => {
      const patient = await seedPatient();
      await expect(controller.listImportedEvents(patient.id, undefined, 'not-a-cursor', physicianUser)).rejects.toThrow('cursor');
    });
  });

  describe('GET /patients', () => {
    it('should return paginated list of patients', async () => {
      await seedPatient();

      const result = await controller.list({ page: 1, pageSize: 20 }, physicianUser);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('GET /patients/search', () => {
    it('should search patients', async () => {
      await seedPatient();

      const result = await controller.search(
        { query: 'García', page: 1, pageSize: 20, sortBy: 'lastName', sortOrder: 'asc' },
        physicianUser,
      );

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('PATCH /patients/:id', () => {
    it('should update patient', async () => {
      const patient = await seedPatient();

      const result = await controller.update(
        patient.id,
        { firstName: 'María Elena' },
        physicianUser,
      );

      expect(result.firstName).toBe('María Elena');
    });
  });

  describe('DELETE /patients/:id', () => {
    it('should soft-delete patient', async () => {
      const patient = await seedPatient();

      const result = await controller.remove(patient.id, physicianUser);

      expect(result).toHaveProperty('deletedAt');
      expect(result.deletedAt).not.toBeNull();
    });
  });

  describe('Allergy endpoints', () => {
    it('should create allergy for patient', async () => {
      const patient = await seedPatient();

      const result = await controller.createAllergy(
        patient.id,
        { substance: 'Penicilina', severity: 'SEVERE' },
        undefined,
        physicianUser,
      );

      expect(result.substance).toBe('Penicilina');
      expect(result.severity).toBe('SEVERE');
    });

    it('should list allergies for patient', async () => {
      const patient = await seedPatient();
      await controller.createAllergy(
        patient.id,
        { substance: 'Penicilina', severity: 'SEVERE' },
        undefined,
        physicianUser,
      );

      const result = await controller.listAllergies(patient.id, physicianUser);

      expect(result).toHaveLength(1);
    });

    it('should update allergy', async () => {
      const patient = await seedPatient();
      const allergy = await controller.createAllergy(
        patient.id,
        { substance: 'Penicilina', severity: 'SEVERE' },
        undefined,
        physicianUser,
      );

      const result = await controller.updateAllergy(
        patient.id,
        allergy.id,
        { status: 'INACTIVE' },
        undefined,
        physicianUser,
      );

      expect(result.status).toBe('INACTIVE');
    });

    it('should soft-delete allergy', async () => {
      const patient = await seedPatient();
      const allergy = await controller.createAllergy(
        patient.id,
        { substance: 'Penicilina', severity: 'SEVERE' },
        undefined,
        physicianUser,
      );

      const result = await controller.deleteAllergy(patient.id, allergy.id, physicianUser);

      expect(result).toHaveProperty('deletedAt');
      expect(result.deletedAt).not.toBeNull();
    });
  });
});
