// apps/api/src/infrastructure/database/repositories/patient.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Patient } from '@/domain/patient/patient.entity';
import type { IPatientRepository, FindAllParams, SearchParams, CreatePatientInput, UpdatePatientInput } from '@/domain/patient/patient.repository.interface';
import { NHC } from '@/domain/patient/value-objects/nhc.vo';

@Injectable()
export class PrismaPatientRepository implements IPatientRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, organizationId: string): Promise<Patient | null> {
    const record = await this.prisma.patient.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!record) return null;
    return this.toEntity(record);
  }

  async findByIdWithAllergies(id: string, organizationId: string): Promise<Patient | null> {
    const record = await this.prisma.patient.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { allergies: { where: { deletedAt: null } } },
    });
    if (!record) return null;
    return this.toEntityWithAllergies(record);
  }

  async findAll(params: FindAllParams): Promise<{ items: Patient[]; total: number }> {
    const where = { organizationId: params.organizationId, deletedAt: null };

    const [records, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        orderBy: { [params.sortBy]: params.sortOrder },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.patient.count({ where }),
    ]);

    return { items: records.map((r) => this.toEntity(r)), total };
  }

  async search(params: SearchParams): Promise<{ items: Patient[]; total: number }> {
    const where = {
      organizationId: params.organizationId,
      deletedAt: null,
      OR: [
        { firstName: { contains: params.query, mode: 'insensitive' as const } },
        { lastName: { contains: params.query, mode: 'insensitive' as const } },
        { nhc: { contains: params.query, mode: 'insensitive' as const } },
        { idDocument: { contains: params.query, mode: 'insensitive' as const } },
      ],
    };

    const [records, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        orderBy: { [params.sortBy]: params.sortOrder },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.patient.count({ where }),
    ]);

    return { items: records.map((r) => this.toEntity(r)), total };
  }

  async findDuplicates(organizationId: string, lastName: string, birthDate: Date): Promise<Patient[]> {
    const records = await this.prisma.patient.findMany({
      where: {
        organizationId,
        deletedAt: null,
        lastName: { equals: lastName, mode: 'insensitive' },
        birthDate,
      },
    });
    return records.map((r) => this.toEntity(r));
  }

  async create(data: CreatePatientInput): Promise<Patient> {
    const record = await this.prisma.patient.create({
      data: {
        organizationId: data.organizationId,
        nhc: data.nhc,
        firstName: data.firstName,
        lastName: data.lastName,
        birthDate: data.birthDate,
        sex: data.sex as any,
        phone: data.phone,
        email: data.email,
        address: data.address as any,
        emergencyContact: data.emergencyContact as any,
        idDocument: data.idDocument,
        idDocType: data.idDocType as any,
        bloodType: data.bloodType as any,
        notes: data.notes,
        createdBy: data.createdBy,
      },
    });
    return this.toEntity(record);
  }

  async update(id: string, _organizationId: string, data: UpdatePatientInput): Promise<Patient> {
    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: new Date(),
    };

    const record = await this.prisma.patient.update({
      where: { id },
      data: updateData,
    });
    return this.toEntity(record);
  }

  async softDelete(id: string, _organizationId: string): Promise<Patient> {
    const record = await this.prisma.patient.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return this.toEntity(record);
  }

  async getNextNhcSequence(organizationId: string): Promise<string> {
    const currentYear = new Date().getFullYear();

    // Use a transaction to atomically get the next NHC sequence
    const result = await this.prisma.$transaction(async (tx) => {
      // Find the highest NHC for the org in this year
      const lastPatient = await tx.patient.findFirst({
        where: {
          organizationId,
          nhc: { startsWith: `${currentYear}-` },
        },
        orderBy: { nhc: 'desc' },
        select: { nhc: true },
      });

      let nextSeq = 1;
      if (lastPatient?.nhc) {
        const nhc = NHC.parse(lastPatient.nhc);
        nextSeq = nhc.sequence + 1;
      }

      return NHC.generate(currentYear, nextSeq).value;
    });

    return result;
  }

  async hasScheduledSurgeries(patientId: string, organizationId: string): Promise<boolean> {
    const count = await this.prisma.surgery.count({
      where: {
        patientId,
        organizationId,
        status: { in: ['SCHEDULED', 'POSTPONED'] },
        deletedAt: null,
      },
    });
    return count > 0;
  }

  async countByOrg(organizationId: string): Promise<number> {
    return this.prisma.patient.count({
      where: { organizationId, deletedAt: null },
    });
  }

  private toEntity(record: any): Patient {
    return new Patient({
      id: record.id,
      organizationId: record.organizationId,
      nhc: record.nhc,
      firstName: record.firstName,
      lastName: record.lastName,
      birthDate: record.birthDate,
      sex: record.sex,
      phone: record.phone,
      email: record.email,
      address: record.address,
      emergencyContact: record.emergencyContact,
      idDocument: record.idDocument,
      idDocType: record.idDocType,
      bloodType: record.bloodType,
      notes: record.notes,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      allergies: record.allergies?.map((a: any) => ({
        id: a.id,
        patientId: a.patientId,
        substance: a.substance,
        severity: a.severity,
        status: a.status,
      })) ?? [],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }

  private toEntityWithAllergies(record: any): Patient {
    // Same as toEntity but allergies are included from the query
    return this.toEntity(record);
  }
}