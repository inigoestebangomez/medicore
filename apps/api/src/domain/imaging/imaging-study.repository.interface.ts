// apps/api/src/domain/imaging/imaging-study.repository.interface.ts
import type { ImagingStudy } from './imaging-study.entity';
import type { ImagingStudyType } from '@medicore/contracts';
import type { FileMetadataEntry } from './imaging-study.entity';

export interface ListImagingStudiesParams {
  patientId: string;
  organizationId: string;
  page: number;
  pageSize: number;
  sortBy: 'date' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  type?: ImagingStudyType;
  from?: Date;
  to?: Date;
}

export interface CreateImagingStudyInput {
  organizationId: string;
  patientId: string;
  surgeryId?: string | null;
  consultationId?: string | null;
  type: ImagingStudyType;
  date: Date;
  description?: string | null;
  findings?: string | null;
  labels?: any[] | null;
  files?: any[];
  createdBy: string;
}

export interface UpdateImagingStudyInput {
  type?: ImagingStudyType;
  date?: Date;
  description?: string | null;
  findings?: string | null;
  labels?: any[] | null;
  surgeryId?: string | null;
  consultationId?: string | null;
  updatedBy: string;
}

export interface IImagingStudyRepository {
  findById(id: string, organizationId: string): Promise<ImagingStudy | null>;
  findByPatientId(id: string, patientId: string, organizationId: string): Promise<ImagingStudy | null>;
  listByPatient(params: ListImagingStudiesParams): Promise<{ items: ImagingStudy[]; total: number }>;
  create(data: CreateImagingStudyInput): Promise<ImagingStudy>;
  update(id: string, organizationId: string, data: UpdateImagingStudyInput): Promise<ImagingStudy>;
  appendFiles(id: string, organizationId: string, files: FileMetadataEntry[]): Promise<ImagingStudy>;
  softDelete(id: string, organizationId: string): Promise<ImagingStudy>;
}