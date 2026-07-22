// apps/api/src/domain/research/patient-collection.entity.ts
// Domain entity: PatientCollection — a cohort of patients for longitudinal
// tracking or study publication (spec §11).
// BR-RES-003: once locked (isLocked=true), a collection is immutable — no
// members may be added or removed.

import { CollectionLockedError } from './errors/collection-locked.error';

export interface CollectionMemberProps {
  collectionId: string;
  patientId: string;
  addedBy: string;
  addedAt?: Date;
  notes?: string | null;
}

export class CollectionMember {
  readonly collectionId: string;
  readonly patientId: string;
  readonly addedBy: string;
  readonly addedAt: Date;
  readonly notes: string | null;

  constructor(props: CollectionMemberProps) {
    this.collectionId = props.collectionId;
    this.patientId = props.patientId;
    this.addedBy = props.addedBy;
    this.addedAt = props.addedAt ?? new Date();
    this.notes = props.notes ?? null;
  }
}

export interface PatientCollectionProps {
  id: string;
  organizationId: string;
  createdBy: string;
  name: string;
  description?: string | null;
  queryId?: string | null;
  isLocked: boolean;
  members?: CollectionMember[];
  patientCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class PatientCollection {
  readonly id: string;
  readonly organizationId: string;
  readonly createdBy: string;
  readonly name: string;
  readonly description: string | null;
  readonly queryId: string | null;
  readonly isLocked: boolean;
  readonly members: CollectionMember[];
  readonly patientCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: PatientCollectionProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.createdBy = props.createdBy;
    this.name = props.name;
    this.description = props.description ?? null;
    this.queryId = props.queryId ?? null;
    this.isLocked = props.isLocked ?? false;
    this.members = props.members ?? [];
    this.patientCount = props.patientCount ?? (props.members?.length ?? 0);
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.deletedAt = props.deletedAt ?? null;
  }

  // ─────────────────────────────────────────────
  // Factory
  // ─────────────────────────────────────────────

  static create(props: {
    id: string;
    organizationId: string;
    createdBy: string;
    name: string;
    description?: string;
    queryId?: string;
  }): PatientCollection {
    return new PatientCollection({
      id: props.id,
      organizationId: props.organizationId,
      createdBy: props.createdBy,
      name: props.name,
      description: props.description ?? null,
      queryId: props.queryId ?? null,
      isLocked: false,
      members: [],
    });
  }

  /**
   * Create a collection from a saved query's result set.
   * The queryId links back so the frontend can show origin.
   */
  static fromQuery(props: {
    id: string;
    organizationId: string;
    createdBy: string;
    name: string;
    queryId: string;
    patientIds: string[];
    description?: string;
  }): PatientCollection {
    const members = props.patientIds.map((patientId) =>
      new CollectionMember({
        collectionId: props.id,
        patientId,
        addedBy: props.createdBy,
      }),
    );
    return new PatientCollection({
      id: props.id,
      organizationId: props.organizationId,
      createdBy: props.createdBy,
      name: props.name,
      description: props.description ?? null,
      queryId: props.queryId,
      isLocked: false,
      members,
      patientCount: members.length,
    });
  }

  // ─────────────────────────────────────────────
  // Member management — BR-RES-003 (immutable when locked)
  // ─────────────────────────────────────────────

  private assertUnlocked(): void {
    if (this.isLocked) {
      throw new CollectionLockedError(this.id);
    }
  }

  addMember(patientId: string, addedBy: string, notes?: string): PatientCollection {
    this.assertUnlocked();

    // Idempotent: if member already exists, don't duplicate
    if (this.members.some((m) => m.patientId === patientId)) {
      return this;
    }

    const newMember = new CollectionMember({
      collectionId: this.id,
      patientId,
      addedBy,
      notes,
    });

    const updatedMembers = [...this.members, newMember];
    return new PatientCollection({
      ...this,
      members: updatedMembers,
      patientCount: updatedMembers.length,
      updatedAt: new Date(),
    });
  }

  addMembers(patientIds: string[], addedBy: string, notes?: string): PatientCollection {
    this.assertUnlocked();

    const existingIds = new Set(this.members.map((m) => m.patientId));
    const newMembers = patientIds
      .filter((id) => !existingIds.has(id))
      .map((patientId) =>
        new CollectionMember({
          collectionId: this.id,
          patientId,
          addedBy,
          notes,
        }),
      );

    if (newMembers.length === 0) return this;

    const allMembers = [...this.members, ...newMembers];
    return new PatientCollection({
      ...this,
      members: allMembers,
      patientCount: allMembers.length,
      updatedAt: new Date(),
    });
  }

  removeMember(patientId: string): PatientCollection {
    this.assertUnlocked();

    const updatedMembers = this.members.filter(
      (m) => m.patientId !== patientId,
    );
    if (updatedMembers.length === this.members.length) return this;

    return new PatientCollection({
      ...this,
      members: updatedMembers,
      patientCount: updatedMembers.length,
      updatedAt: new Date(),
    });
  }

  hasMember(patientId: string): boolean {
    return this.members.some((m) => m.patientId === patientId);
  }

  // ─────────────────────────────────────────────
  // Lock — BR-RES-003 (published study → immutable)
  // ─────────────────────────────────────────────

  lock(): PatientCollection {
    if (this.isLocked) return this; // idempotent
    return new PatientCollection({
      ...this,
      isLocked: true,
      updatedAt: new Date(),
    });
  }

  // ─────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────

  rename(name: string, description?: string | null): PatientCollection {
    // Renaming a locked collection is allowed — it's metadata, not cohort data
    return new PatientCollection({
      ...this,
      name,
      description: description !== undefined ? description : this.description,
      updatedAt: new Date(),
    });
  }

  delete(): PatientCollection {
    return new PatientCollection({
      ...this,
      deletedAt: new Date(),
    });
  }

  get isDeleted(): boolean {
    return this.deletedAt !== null;
  }
}