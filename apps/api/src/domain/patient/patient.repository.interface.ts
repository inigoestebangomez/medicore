// apps/api/src/domain/patient/patient.repository.interface.ts
import type { Patient } from './patient.entity';

export interface FindAllParams {
  organizationId: string;
  page: number;
  pageSize: number;
  sortBy: 'lastName' | 'createdAt' | 'nhc';
  sortOrder: 'asc' | 'desc';
}

export interface SearchParams {
  organizationId: string;
  query: string;
  page: number;
  pageSize: number;
  sortBy: 'lastName' | 'createdAt' | 'nhc';
  sortOrder: 'asc' | 'desc';
}

export interface CreatePatientInput {
  nhc: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  sex: string;
  phone?: string | null;
  email?: string | null;
  address?: Record<string, unknown> | null;
  emergencyContact?: Record<string, unknown> | null;
  idDocument?: string | null;
  idDocType?: string;
  bloodType?: string;
  notes?: string | null;
  organizationId: string;
  createdBy: string;
}

export interface UpdatePatientInput {
  firstName?: string;
  lastName?: string;
  birthDate?: Date;
  sex?: string;
  phone?: string | null;
  email?: string | null;
  address?: Record<string, unknown> | null;
  emergencyContact?: Record<string, unknown> | null;
  idDocument?: string | null;
  idDocType?: string;
  bloodType?: string;
  notes?: string | null;
  updatedBy: string;
}

// Phase 11 — import enrichment inputs. These never overwrite manual standard
// fields (BR-IMP-003): the repository only applies them when the existing
// standard field is empty.
export interface EnrichPatientInput {
  birthDate?: Date | null;
  sex?: string | null;
  importedData: Record<string, unknown>; // full updated importedData object
  importBatchId?: string | null;
  importSource?: string | null;
}

export interface IPatientRepository {
  findById(id: string, organizationId: string): Promise<Patient | null>;
  findByIdWithAllergies(id: string, organizationId: string): Promise<Patient | null>;
  findAll(params: FindAllParams): Promise<{ items: Patient[]; total: number }>;
  search(params: SearchParams): Promise<{ items: Patient[]; total: number }>;
  findDuplicates(organizationId: string, lastName: string, birthDate: Date): Promise<Patient[]>;
  create(data: CreatePatientInput): Promise<Patient>;
  update(id: string, organizationId: string, data: UpdatePatientInput): Promise<Patient>;
  softDelete(id: string, organizationId: string): Promise<Patient>;
  getNextNhcSequence(organizationId: string): Promise<string>;
  hasScheduledSurgeries(patientId: string, organizationId: string): Promise<boolean>;
  countByOrg(organizationId: string): Promise<number>;
  // Phase 11 — import matching + enrichment (backward-compatible additions).
  findByNhc(nhc: string, organizationId: string): Promise<Patient | null>;
  searchByNameFuzzy(organizationId: string, lastName: string, firstName?: string): Promise<Patient[]>;
  enrich(id: string, organizationId: string, data: EnrichPatientInput, updatedBy: string): Promise<Patient>;
  /**
   * BR-IMP-005 (revert): strip this batch's importedData block and clear
   * importBatchId for every patient created or enriched by the batch.
   * Manual standard fields are never touched. Returns the affected count.
   */
  removeImportedBatch(batchId: string, organizationId: string): Promise<number>;
}