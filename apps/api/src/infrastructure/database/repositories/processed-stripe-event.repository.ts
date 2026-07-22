// apps/api/src/infrastructure/database/repositories/processed-stripe-event.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { IProcessedStripeEventRepository } from '@/domain/billing/stripe-event.repository.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaProcessedStripeEventRepository implements IProcessedStripeEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async tryInsert(eventId: string, eventType: string): Promise<boolean> {
    try {
      await this.prisma.processedStripeEvent.create({
        data: { eventId, eventType },
      });
      return true;
    } catch (error) {
      // Unique-constraint violation (P2002) → event already processed.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }
}