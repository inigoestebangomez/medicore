// apps/api/src/infrastructure/database/repositories/medication.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Medication } from '@/domain/medication/medication.entity';
import type { IMedicationRepository, CreateMedicationInput, UpdateMedicationInput, ListMedicationsParams } from '@/domain/medication/medication.repository.interface';

@Injectable()
export class PrismaMedicationRepository implements IMedicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, organizationId: string): Promise<Medication | null> {
    const record = await this.prisma.medicationPrescription.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!record) return null;
    return this.toEntity(record);
  }

  async listByPatient(params: ListMedicationsParams): Promise<{ items: Medication[]; total: number }> {
    const where: Record<string, unknown> = {
      patientId: params.patientId,
      organizationId: params.organizationId,
      deletedAt: null,
    };

    if (params.status) {
      where.status = params.status;
    }

    const [records, total] = await Promise.all([
      this.prisma.medicationPrescription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.medicationPrescription.count({ where }),
    ]);

    return { items: records.map((r) => this.toEntity(r)), total };
  }

  async create(data: CreateMedicationInput): Promise<Medication> {
    const record = await this.prisma.medicationPrescription.create({
      data: {
        organizationId: data.organizationId,
        patientId: data.patientId,
        consultationId: data.consultationId,
        physicianId: data.physicianId,
        drugName: data.drugName,
        drugCode: data.drugCode,
        activeIngredient: data.activeIngredient,
        dosage: data.dosage,
        frequency: data.frequency,
        route: data.route,
        form: data.form,
        startDate: data.startDate,
        endDate: data.endDate,
        duration: data.duration,
        status: data.status as any,
        instructions: data.instructions,
        reason: data.reason,
        createdBy: data.createdBy,
        auditLog: data.auditLog ?? undefined,
      },
    });
    return this.toEntity(record);
  }

  async update(id: string, _organizationId: string, data: UpdateMedicationInput): Promise<Medication> {
    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: new Date(),
    };

    const record = await this.prisma.medicationPrescription.update({
      where: { id },
      data: updateData,
    });
    return this.toEntity(record);
  }

  async softDelete(id: string, _organizationId: string): Promise<Medication> {
    const record = await this.prisma.medicationPrescription.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return this.toEntity(record);
  }

  async findActiveByActiveIngredient(patientId: string, organizationId: string, activeIngredient: string): Promise<Medication[]> {
    const records = await this.prisma.medicationPrescription.findMany({
      where: {
        patientId,
        organizationId,
        activeIngredient,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });
    return records.map((r) => this.toEntity(r));
  }

  private toEntity(record: any): Medication {
    return new Medication({
      id: record.id,
      organizationId: record.organizationId,
      patientId: record.patientId,
      consultationId: record.consultationId ?? null,
      physicianId: record.physicianId,
      drugName: record.drugName,
      drugCode: record.drugCode ?? null,
      activeIngredient: record.activeIngredient ?? null,
      dosage: record.dosage,
      frequency: record.frequency,
      route: record.route ?? null,
      form: record.form ?? null,
      startDate: record.startDate,
      endDate: record.endDate ?? null,
      duration: record.duration ?? null,
      status: record.status,
      instructions: record.instructions ?? null,
      reason: record.reason ?? null,
      discontinuationReason: record.discontinuationReason ?? null,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy ?? null,
      auditLog: record.auditLog ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt ?? null,
    });
  }
}