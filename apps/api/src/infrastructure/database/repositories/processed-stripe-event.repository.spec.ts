// apps/api/src/infrastructure/database/repositories/processed-stripe-event.repository.spec.ts
// Unit tests for the idempotency repo: PK insert, dup handled via P2002.

import { Prisma } from '@prisma/client';
import { PrismaProcessedStripeEventRepository } from './processed-stripe-event.repository';

function p2002(): Prisma.PrismaClientKnownRequestError {
  // Construct a P2002 without hitting the real constructor signature.
  const err = new (Prisma.PrismaClientKnownRequestError as any)(
    'unique constraint failed',
    { code: 'P2002', clientVersion: '5.22.0' },
  );
  return err;
}

const mockPrisma = {
  processedStripeEvent: {
    create: jest.fn(),
  },
};

describe('PrismaProcessedStripeEventRepository', () => {
  let repo: PrismaProcessedStripeEventRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PrismaProcessedStripeEventRepository(mockPrisma as any);
  });

  it('returns true when the event is inserted (first time seen)', async () => {
    mockPrisma.processedStripeEvent.create.mockResolvedValue({});
    const result = await repo.tryInsert('evt_123', 'checkout.session.completed');
    expect(result).toBe(true);
    expect(mockPrisma.processedStripeEvent.create).toHaveBeenCalledWith({
      data: { eventId: 'evt_123', eventType: 'checkout.session.completed' },
    });
  });

  it('returns false on a P2002 unique constraint (duplicate event)', async () => {
    mockPrisma.processedStripeEvent.create.mockRejectedValue(p2002());
    const result = await repo.tryInsert('evt_dup', 'checkout.session.completed');
    expect(result).toBe(false);
  });

  it('re-throws non-P2002 errors', async () => {
    mockPrisma.processedStripeEvent.create.mockRejectedValue(new Error('connection lost'));
    await expect(repo.tryInsert('evt_x', 'x')).rejects.toThrow('connection lost');
  });
});