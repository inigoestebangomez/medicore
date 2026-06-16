// apps/api/src/infrastructure/database/repositories/allergy.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Allergy } from '@/domain/allergy/allergy.entity';
import type { IAllergyRepository, CreateAllergyInput, UpdateAllergyInput } from '@/domain/allergy/allergy.repository.interface';

@Injectable()
export class PrismaAllergyRepository implements IAllergyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPatientId(patientId: string, organizationId: string): Promise<Allergy[]> {
    const records = await this.prisma.allergy.findMany({
      where: { patientId, organizationId, deletedAt: null },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findById(id: string, organizationId: string): Promise<Allergy | null> {
    const record = await this.prisma.allergy.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!record) return null;
    return this.toEntity(record);
  }

  async create(data: CreateAllergyInput): Promise<Allergy> {
    const record = await this.prisma.allergy.create({
      data: {
        organizationId: data.organizationId,
        patientId: data.patientId,
        substance: data.substance,
        substanceCode: data.substanceCode,
        reaction: data.reaction,
        severity: data.severity as any,
        status: data.status as any,
        onsetDate: data.onsetDate,
        notes: data.notes,
        createdBy: data.createdBy,
      },
    });
    return this.toEntity(record);
  }

  async update(id: string, _organizationId: string, data: UpdateAllergyInput): Promise<Allergy> {
    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: new Date(),
    };

    const record = await this.prisma.allergy.update({
      where: { id },
      data: updateData,
    });
    return this.toEntity(record);
  }

  async softDelete(id: string, _organizationId: string): Promise<Allergy> {
    const record = await this.prisma.allergy.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return this.toEntity(record);
  }

  private toEntity(record: any): Allergy {
    return new Allergy({
      id: record.id,
      organizationId: record.organizationId,
      patientId: record.patientId,
      substance: record.substance,
      substanceCode: record.substanceCode,
      reaction: record.reaction,
      severity: record.severity,
      status: record.status,
      onsetDate: record.onsetDate,
      notes: record.notes,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }
}