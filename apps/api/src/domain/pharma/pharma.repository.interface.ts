// apps/api/src/domain/pharma/pharma.repository.interface.ts
export type InteractionType = 'CALL' | 'MEETING' | 'EMAIL' | 'LUNCH' | 'CONFERENCE' | 'OTHER';

export interface PharmaContact {
  id: string;
  organizationId: string;
  name: string;
  company: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  lastContactAt: Date | null;
  nextFollowUpAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface PharmaInteraction {
  id: string;
  organizationId: string;
  contactId: string;
  date: Date;
  type: InteractionType;
  notes: string | null;
  followUpNeeded: boolean;
  createdAt: Date;
}

export interface ListContactsParams {
  organizationId: string;
  page: number;
  pageSize: number;
  company?: string;
}

export interface CreateContactInput {
  organizationId: string;
  name: string;
  company: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  lastContactAt?: Date | null;
  nextFollowUpAt?: Date | null;
}

export interface UpdateContactInput {
  name?: string;
  company?: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  lastContactAt?: Date | null;
  nextFollowUpAt?: Date | null;
}

export interface CreateInteractionInput {
  organizationId: string;
  contactId: string;
  type?: InteractionType;
  notes?: string | null;
  followUpNeeded?: boolean;
  date?: Date;
}

export interface IPharmaRepository {
  listContacts(params: ListContactsParams): Promise<{ items: PharmaContact[]; total: number }>;
  createContact(data: CreateContactInput): Promise<PharmaContact>;
  updateContact(id: string, organizationId: string, data: UpdateContactInput): Promise<PharmaContact>;
  deleteContact(id: string, organizationId: string): Promise<void>;
  listInteractions(organizationId: string, contactId: string): Promise<PharmaInteraction[]>;
  createInteraction(data: CreateInteractionInput): Promise<PharmaInteraction>;
}