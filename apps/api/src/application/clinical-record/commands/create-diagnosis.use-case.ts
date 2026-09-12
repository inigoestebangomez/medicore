// apps/api/src/application/clinical-record/commands/create-diagnosis.use-case.ts
// Use-case: Create a diagnosis with catalog validation (spec §6).
// Validates CIE-10-ES/SNOMED codes against versioned catalogs; rejects unknown codes.

import type { IDiagnosisRepository } from '@/domain/clinical-record/diagnosis/diagnosis.repository.interface';
import type { DiagnosisCodeSystem } from '@/domain/clinical-record/diagnosis/diagnosis.entity';
import { validateCode, getByCode } from '@medicore/clinical-codes';
import type { CodeSystem } from '@medicore/clinical-codes';

/**
 * Map the contract code system names to the clinical-codes package names.
 * CIE-10-ES is the Spanish name for ICD-10 (International Classification of Diseases).
 */
function toCatalogSystem(system: DiagnosisCodeSystem): CodeSystem {
  return system === 'CIE-10-ES' ? 'ICD10' : 'SNOMED';
}

export interface CreateDiagnosisCommand {
  organizationId: string;
  patientId: string;
  system: DiagnosisCodeSystem;
  code: string;
  description?: string;
  catalogVersion: string;
  status?: 'ACTIVE' | 'RESOLVED' | 'DISCARDED';
  variables?: Record<string, string | number | boolean>;
  consultationId?: string | null;
  sourceType: string;
  authorId: string;
}

export class CreateDiagnosisUseCase {
  constructor(private readonly diagnosisRepo: IDiagnosisRepository) {}

  async execute(cmd: CreateDiagnosisCommand) {
    // 1. Validate the code against the catalog (spec §6: reject unknown codes)
    const catalogSystem = toCatalogSystem(cmd.system);
    const isValid = validateCode(catalogSystem, cmd.code);
    if (!isValid) {
      throw new InvalidDiagnosisCodeError(cmd.system, cmd.code);
    }

    // 2. Resolve description from catalog if not explicitly provided
    const catalogEntry = getByCode(catalogSystem, cmd.code);
    const description = cmd.description ?? catalogEntry?.description ?? '';

    // 3. Create the diagnosis
    return this.diagnosisRepo.create({
      organizationId: cmd.organizationId,
      patientId: cmd.patientId,
      system: cmd.system,
      code: cmd.code,
      description,
      catalogVersion: cmd.catalogVersion,
      status: cmd.status ?? 'ACTIVE',
      variables: cmd.variables ?? {},
      consultationId: cmd.consultationId ?? null,
      sourceType: cmd.sourceType,
      authorId: cmd.authorId,
      recordedAt: new Date(),
    });
  }
}

export class InvalidDiagnosisCodeError extends Error {
  constructor(
    public readonly system: DiagnosisCodeSystem,
    public readonly code: string,
  ) {
    super(`Unknown diagnosis code: ${system}:${code}`);
    this.name = 'InvalidDiagnosisCodeError';
  }
}
