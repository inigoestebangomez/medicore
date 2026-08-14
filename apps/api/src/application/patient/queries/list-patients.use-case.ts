// apps/api/src/application/patient/queries/list-patients.use-case.ts
import type { IPatientRepository, FindAllParams } from '@/domain/patient/patient.repository.interface';
import type { MemberRole } from '@medicore/contracts';

export interface ListPatientsQuery {
  organizationId: string;
  role: MemberRole;
  page: number;
  pageSize: number;
  sortBy: 'lastName' | 'createdAt' | 'nhc';
  sortOrder: 'asc' | 'desc';
}

export interface ListPatientsResponse {
  items: PatientListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PatientListItem {
  id: string;
  nhc: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  sex: string;
  age: number | null;
  isPediatric: boolean;
  hasCriticalAllergy: boolean;
  hasActiveAllergies: boolean;
  bloodType: string;
  createdAt: string;
  updatedAt: string;
  // Sensitive — only for PHI-authorized roles
  phone?: string | null;
  email?: string | null;
  idDocument?: string | null;
}

export class ListPatientsUseCase {
  constructor(private readonly patientRepo: IPatientRepository) {}

  async execute(query: ListPatientsQuery): Promise<ListPatientsResponse> {
    const { organizationId, role, page, pageSize, sortBy, sortOrder } = query;

    const params: FindAllParams = {
      organizationId,
      page,
      pageSize,
      sortBy,
      sortOrder,
    };

    const { items, total } = await this.patientRepo.findAll(params);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    const listItems: PatientListItem[] = items.map((p) => {
      const item: PatientListItem = {
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

      // BR-RBAC-002: Only PHI-authorized roles see sensitive fields
      if (role === 'PHYSICIAN' || role === 'OWNER' || role === 'ADMIN') {
        item.phone = p.phone;
        item.email = p.email;
        item.idDocument = p.idDocument;
      }

      return item;
    });

    return {
      items: listItems,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}
