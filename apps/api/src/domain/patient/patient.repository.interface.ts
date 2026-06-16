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
  birthDate: Date;
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
}