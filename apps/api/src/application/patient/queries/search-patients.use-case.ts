// apps/api/src/application/patient/queries/search-patients.use-case.ts
import type { IPatientRepository, SearchParams } from '@/domain/patient/patient.repository.interface';
import type { MemberRole } from '@medicore/contracts';

export interface SearchPatientsQuery {
  organizationId: string;
  role: MemberRole;
  query: string;
  page: number;
  pageSize: number;
  sortBy: 'lastName' | 'createdAt' | 'nhc';
  sortOrder: 'asc' | 'desc';
}

export interface SearchPatientsResponse {
  items: PatientSearchItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PatientSearchItem {
  id: string;
  nhc: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  sex: string;
  age: number | null;
  isPediatric: boolean;
  hasCriticalAllergy: boolean;
  hasActiveAllergies: boolean;
  bloodType: string;
  idDocument?: string | null;
  createdAt: string;
  updatedAt: string;
}

export class SearchPatientsUseCase {
  constructor(private readonly patientRepo: IPatientRepository) {}

  async execute(query: SearchPatientsQuery): Promise<SearchPatientsResponse> {
    const { organizationId, role, query: searchQuery, page, pageSize, sortBy, sortOrder } = query;

    const params: SearchParams = {
      organizationId,
      query: searchQuery,
      page,
      pageSize,
      sortBy,
      sortOrder,
    };

    const { items, total } = await this.patientRepo.search(params);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    const searchItems: PatientSearchItem[] = items.map((p) => {
      const item: PatientSearchItem = {
        id: p.id,
        nhc: p.nhc,
        firstName: p.firstName,
        lastName: p.lastName,
        birthDate: p.birthDate ? p.birthDate.toISOString() : null,
        sex: p.sex,
        age: p.age(),
        isPediatric: p.isPediatric(),
        hasCriticalAllergy: p.hasCriticalAllergy,
        hasActiveAllergies: p.hasActiveAllergies,
        bloodType: p.bloodType,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };

      // BR-RBAC-002: Only PHI-authorized roles see idDocument in search results
      if (role === 'PHYSICIAN' || role === 'OWNER' || role === 'ADMIN') {
        item.idDocument = p.idDocument;
      }

      return item;
    });

    return {
      items: searchItems,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}