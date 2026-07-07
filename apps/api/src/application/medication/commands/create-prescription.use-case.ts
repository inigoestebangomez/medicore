// apps/api/src/application/medication/commands/create-prescription.use-case.ts
// BR-MED-001: Allergy conflict detection — ANAPHYLAXIS blocks without override
// BR-MED-002: Duplication warning for same activeIngredient

import type { IMedicationRepository, CreateMedicationInput } from '@/domain/medication/medication.repository.interface';
import type { IAllergyRepository } from '@/domain/allergy/allergy.repository.interface';
import type { IPatientRepository } from '@/domain/patient/patient.repository.interface';
import type { Medication } from '@/domain/medication/medication.entity';
import type { MedicationStatus } from '@medicore/contracts';
import { AllergyConflictCriticalError } from '@/domain/medication/errors/allergy-conflict-critical.error';
import { PatientNotActiveError } from '@/domain/consultation/errors/patient-not-active.error';

export interface AllergyWarning {
  level: 'CRITICAL' | 'SEVERE' | 'MODERATE' | 'MILD';
  substances: string[];
}

export interface CreatePrescriptionCommand {
  organizationId: string;
  patientId: string;
  consultationId?: string;
  drugName: string;
  drugCode?: string;
  activeIngredient?: string;
  dosage: string;
  frequency: string;
  route?: string;
  form?: string;
  startDate: Date;
  endDate?: Date;
  duration?: string;
  instructions?: string;
  reason?: string;
  physicianId: string;
  createdBy: string;
  overrideCriticalAllergy?: boolean;
}

export interface CreatePrescriptionResult {
  medication: Medication;
  allergyWarning?: AllergyWarning;
  duplicationWarning: boolean;
}

export class CreatePrescriptionUseCase {
  constructor(
    private readonly medicationRepo: IMedicationRepository,
    private readonly allergyRepo: IAllergyRepository,
    private readonly patientRepo: IPatientRepository,
  ) {}

  async execute(command: CreatePrescriptionCommand): Promise<CreatePrescriptionResult> {
    // Verify patient exists and is active
    const patient = await this.patientRepo.findById(command.patientId, command.organizationId);
    if (!patient) {
      throw new PatientNotActiveError(command.patientId);
    }

    // BR-MED-001: Check patient allergies against drugName and activeIngredient
    const allergies = await this.allergyRepo.findByPatientId(command.patientId, command.organizationId);
    const activeAllergies = allergies.filter(a => a.isActive && !a.deletedAt);

    let allergyWarning: AllergyWarning | undefined;
    const matchedTriggers: string[] = [];

    for (const allergy of activeAllergies) {
      const substanceLower = allergy.substance.toLowerCase();
      const drugNameMatch = command.drugName.toLowerCase().includes(substanceLower) ||
        substanceLower.includes(command.drugName.toLowerCase());
      const ingredientMatch = command.activeIngredient &&
        (command.activeIngredient.toLowerCase().includes(substanceLower) ||
         substanceLower.includes(command.activeIngredient!.toLowerCase()));

      if (drugNameMatch || ingredientMatch) {
        // MVP: Substance name matching only (ATC family lookup deferred)
        matchedTriggers.push(allergy.substance);

        if (allergy.severity === 'ANAPHYLAXIS') {
          // Hard block unless override header is provided
          if (!command.overrideCriticalAllergy) {
            throw new AllergyConflictCriticalError(allergy.substance);
          }
          // Override with audit — set critical warning level
          allergyWarning = { level: 'CRITICAL', substances: matchedTriggers };
        } else if (allergy.severity === 'SEVERE' || allergy.severity === 'MODERATE') {
          allergyWarning = { level: allergy.severity === 'SEVERE' ? 'SEVERE' : 'MODERATE', substances: matchedTriggers };
        } else {
          allergyWarning = { level: 'MILD', substances: matchedTriggers };
        }
      }
    }

    // BR-MED-002: Duplication warning — check active same activeIngredient
    let duplicationWarning = false;
    if (command.activeIngredient) {
      const activeDuplicates = await this.medicationRepo.findActiveByActiveIngredient(
        command.patientId,
        command.organizationId,
        command.activeIngredient,
      );
      duplicationWarning = activeDuplicates.length > 0;
    }

    // Create medication with ACTIVE status by default
    const status: MedicationStatus = 'ACTIVE';

    // Build audit log entry for creation
    const auditLog = [{
      action: 'CREATE',
      performedBy: command.createdBy,
      performedAt: new Date(),
      details: allergyWarning?.level === 'CRITICAL'
        ? `Prescription created with critical allergy override for: ${matchedTriggers.join(', ')}`
        : 'Prescription created',
    }];

    const data: CreateMedicationInput = {
      organizationId: command.organizationId,
      patientId: command.patientId,
      consultationId: command.consultationId ?? null,
      physicianId: command.physicianId,
      drugName: command.drugName,
      drugCode: command.drugCode ?? null,
      activeIngredient: command.activeIngredient ?? null,
      dosage: command.dosage,
      frequency: command.frequency,
      route: command.route ?? null,
      form: command.form ?? null,
      startDate: command.startDate,
      endDate: command.endDate ?? null,
      duration: command.duration ?? null,
      status,
      instructions: command.instructions ?? null,
      reason: command.reason ?? null,
      createdBy: command.createdBy,
      auditLog,
    };

    const medication = await this.medicationRepo.create(data);

    return {
      medication,
      allergyWarning: allergyWarning,
      duplicationWarning,
    };
  }
}