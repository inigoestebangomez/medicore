// apps/api/src/domain/research/patient-collection.repository.interface.ts
import type { PatientCollection } from './patient-collection.entity';

export interface FindCollectionsParams {
  organizationId: string;
  page: number;
  pageSize: number;
}

export interface IPatientCollectionRepository {
  save(collection: PatientCollection): Promise<PatientCollection>;
  findById(
    id: string,
    organizationId: string,
  ): Promise<PatientCollection | null>;
  findByOrg(
    params: FindCollectionsParams,
  ): Promise<{ items: PatientCollection[]; total: number }>;
  addMembers(
    collectionId: string,
    organizationId: string,
    patientIds: string[],
    addedBy: string,
    notes?: string,
  ): Promise<PatientCollection>;
  removeMember(
    collectionId: string,
    organizationId: string,
    patientId: string,
  ): Promise<PatientCollection>;
  lock(id: string, organizationId: string): Promise<PatientCollection>;
  softDelete(id: string, organizationId: string): Promise<PatientCollection>;
  getMemberCount(collectionId: string, organizationId: string): Promise<number>;
}