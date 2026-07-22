// apps/api/src/domain/billing/billing-transaction.repository.interface.ts
export type BillingType = 'CONSULTATION' | 'SURGERY' | 'TREATMENT' | 'SUBSCRIPTION' | 'OTHER';
export type BillingStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';

export interface BillingTransaction {
  id: string;
  organizationId: string;
  patientId: string | null;
  consultationId: string | null;
  surgeryId: string | null;
  amount: number;
  type: BillingType;
  status: BillingStatus;
  description: string | null;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ListBillingTransactionsParams {
  organizationId: string;
  page: number;
  pageSize: number;
  type?: BillingType;
  status?: BillingStatus;
  from?: Date;
  to?: Date;
}

export interface CreateBillingTransactionInput {
  organizationId: string;
  patientId?: string | null;
  consultationId?: string | null;
  surgeryId?: string | null;
  amount: number;
  type?: BillingType;
  status?: BillingStatus;
  description?: string | null;
  date?: Date;
}

export interface BillingStats {
  totalThisMonth: number;
  change: { value: number; percent: number; period: 'month' };
  monthly: Array<{ month: string; total: number }>;
  byType: Record<string, number>;
}

export interface IBillingTransactionRepository {
  list(params: ListBillingTransactionsParams): Promise<{ items: BillingTransaction[]; total: number }>;
  create(data: CreateBillingTransactionInput): Promise<BillingTransaction>;
  getStats(organizationId: string): Promise<BillingStats>;
}