// apps/api/src/application/allergy/commands/in-memory-allergy.repository.ts
// In-memory implementation for testing allergy use cases

import type { IAllergyRepository, CreateAllergyInput, UpdateAllergyInput } from '@/domain/allergy/allergy.repository.interface';
import type { Allergy } from '@/domain/allergy/allergy.entity';
import { Allergy as AllergyEntity } from '@/domain/allergy/allergy.entity';

export class InMemoryAllergyRepository implements IAllergyRepository {
  private allergies: Map<string, AllergyEntity> = new Map();
  private nextId = 1;

  async findByPatientId(patientId: string, organizationId: string): Promise<Allergy[]> {
    return Array.from(this.allergies.values()).filter(
      (a) => a.patientId === patientId && a.organizationId === organizationId && !a.deletedAt,
    );
  }

  async findById(id: string, organizationId: string): Promise<Allergy | null> {
    const allergy = this.allergies.get(id);
    if (!allergy || allergy.organizationId !== organizationId || allergy.deletedAt) {
      return null;
    }
    return allergy;
  }

  async create(data: CreateAllergyInput): Promise<Allergy> {
    const id = `allergy-${this.nextId++}`;
    const allergy = new AllergyEntity({
      id,
      organizationId: data.organizationId,
      patientId: data.patientId,
      substance: data.substance,
      substanceCode: data.substanceCode ?? null,
      reaction: data.reaction ?? null,
      severity: data.severity as any,
      status: data.status ? (data.status as any) : 'ACTIVE',
      onsetDate: data.onsetDate ?? null,
      notes: data.notes ?? null,
      createdBy: data.createdBy,
    });
    this.allergies.set(id, allergy);
    return allergy;
  }

  async update(id: string, organizationId: string, data: UpdateAllergyInput): Promise<Allergy> {
    const existing = this.allergies.get(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new Error('Allergy not found');
    }
    const updated = new AllergyEntity({
      ...existing,
      ...Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined)),
      updatedAt: new Date(),
    } as any);
    this.allergies.set(id, updated);
    return updated;
  }

  async softDelete(id: string, organizationId: string): Promise<Allergy> {
    const existing = this.allergies.get(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new Error('Allergy not found');
    }
    const deleted = existing.softDelete();
    this.allergies.set(id, deleted);
    return deleted;
  }
}