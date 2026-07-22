// apps/api/src/application/billing/commands/handle-stripe-webhook.use-case.integration.spec.ts
// Integration tests for the idempotent Stripe webhook use case + repo.
// Pattern: mock IProcessedStripeEventRepository + IOrganizationRepository,
// feed realistic Stripe.Event objects via Stripe SDK constructors so the event
// type shapes match the real library.

import Stripe from 'stripe';
import { HandleStripeWebhookUseCase } from './handle-stripe-webhook.use-case';
import {
  BillingInterval,
  PlanType,
  SubscriptionStatus,
} from '@/domain/organization/organization.types';
import type { IOrganizationRepository, UpdateSubscriptionData } from '@/domain/organization/organization.repository.interface';
import type { IProcessedStripeEventRepository } from '@/domain/billing/stripe-event.repository.interface';

// Used only to construct realistic Stripe.Event objects; the SDK client is never
// instantiated in tests (no network). Keeping the import as a value keeps the
// Stripe types resolvable at runtime for `as Stripe.Event` casts.

class MockEventRepo implements IProcessedStripeEventRepository {
  public inserted: { id: string; type: string }[] = [];
  public returnOnInsert = true;

  async tryInsert(eventId: string, eventType: string): Promise<boolean> {
    if (!this.returnOnInsert) return false;
    this.inserted.push({ id: eventId, type: eventType });
    return true;
  }
}

class MockOrgRepo implements Partial<IOrganizationRepository> {
  public updates: { id: string; data: UpdateSubscriptionData }[] = [];
  async updateSubscription(id: string, data: UpdateSubscriptionData): Promise<any> {
    this.updates.push({ id, data });
    return { id };
  }
}

describe('HandleStripeWebhookUseCase', () => {
  let eventRepo: MockEventRepo;
  let orgRepo: MockOrgRepo;
  let useCase: HandleStripeWebhookUseCase;

  beforeEach(() => {
    eventRepo = new MockEventRepo();
    orgRepo = new MockOrgRepo();
    useCase = new HandleStripeWebhookUseCase(
      eventRepo as any,
      orgRepo as any,
    );
  });

  function buildEvent(type: string, objectData: any, eventId = `evt_${Math.random().toString(36).slice(2)}`): Stripe.Event {
    return {
      id: eventId,
      object: 'event',
      api_version: null,
      created: 123,
      data: { object: objectData },
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type,
    } as Stripe.Event;
  }

  describe('idempotency', () => {
    it('processes a new event and marks it inserted', async () => {
      const event = buildEvent('checkout.session.completed', {
        id: 'cs_1',
        client_reference_id: 'org-1',
        customer: 'cus_1',
        subscription: 'sub_1',
        metadata: { organizationId: 'org-1', plan: 'PRO', interval: 'MONTHLY' },
      });

      const result = await useCase.execute(event);

      expect(result.duplicated).toBe(false);
      expect(eventRepo.inserted).toHaveLength(1);
      expect(orgRepo.updates).toHaveLength(1);
    });

    it('skips processing for a duplicate event (tryInsert returns false)', async () => {
      eventRepo.returnOnInsert = false;
      const event = buildEvent('checkout.session.completed', {
        client_reference_id: 'org-1',
        metadata: { plan: 'PRO' },
      });

      const result = await useCase.execute(event);

      expect(result.duplicated).toBe(true);
      // Critical: duplicate event MUST NOT mutate org state.
      expect(orgRepo.updates).toHaveLength(0);
    });
  });

  describe('checkout.session.completed', () => {
    it('upgrades org to PRO ACTIVE and stores customer/subscription/interval', async () => {
      const event = buildEvent('checkout.session.completed', {
        object: 'checkout.session',
        client_reference_id: 'org-1',
        customer: 'cus_abc',
        subscription: 'sub_xyz',
        metadata: { organizationId: 'org-1', plan: 'PRO', interval: 'YEARLY' },
      });

      await useCase.execute(event);

      expect(orgRepo.updates).toHaveLength(1);
      expect(orgRepo.updates[0].id).toBe('org-1');
      expect(orgRepo.updates[0].data).toMatchObject({
        plan: PlanType.PRO,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_abc',
        stripeSubscriptionId: 'sub_xyz',
        billingInterval: BillingInterval.YEARLY,
      });
    });

    it('is a no-op when no organization id can be resolved', async () => {
      const event = buildEvent('checkout.session.completed', {
        object: 'checkout.session',
        metadata: {},
      });

      await useCase.execute(event);

      expect(orgRepo.updates).toHaveLength(0);
      // Event was still recorded as processed (avoids retry storms).
      expect(eventRepo.inserted).toHaveLength(1);
    });
  });

  describe('customer.subscription.updated', () => {
    it('maps stripe status active → ACTIVE and stores interval + expiry', async () => {
      const event = buildEvent('customer.subscription.updated', {
        object: 'subscription',
        id: 'sub_1',
        status: 'active',
        metadata: { organizationId: 'org-2', plan: 'PRO', interval: 'MONTHLY' },
        items: {
          object: 'list',
          data: [
            {
              id: 'si_1',
              object: 'subscription_item',
              current_period_end: 1800000000,
              price: { id: 'price_1', recurring: { interval: 'month' } },
            },
          ],
        },
      });

      await useCase.execute(event);

      expect(orgRepo.updates[0].id).toBe('org-2');
      expect(orgRepo.updates[0].data).toMatchObject({
        plan: PlanType.PRO,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        stripeSubscriptionId: 'sub_1',
        billingInterval: BillingInterval.MONTHLY,
      });
      expect(orgRepo.updates[0].data.subscriptionExpiresAt).toBeInstanceOf(Date);
    });

    it('maps stripe status past_due → PAST_DUE', async () => {
      const event = buildEvent('customer.subscription.updated', {
        object: 'subscription',
        id: 'sub_1',
        status: 'past_due',
        metadata: { organizationId: 'org-2', plan: 'PRO' },
        items: { object: 'list', data: [{ id: 'si', object: 'subscription_item', price: {} }] },
      });

      await useCase.execute(event);

      expect(orgRepo.updates[0].data.subscriptionStatus).toBe(SubscriptionStatus.PAST_DUE);
    });
  });

  describe('customer.subscription.deleted', () => {
    it('sets status CANCELED and clears stripeSubscriptionId', async () => {
      const event = buildEvent('customer.subscription.deleted', {
        object: 'subscription',
        id: 'sub_dead',
        status: 'canceled',
        metadata: { organizationId: 'org-3', plan: 'PRO' },
        items: { object: 'list', data: [] },
      });

      await useCase.execute(event);

      expect(orgRepo.updates[0].data).toMatchObject({
        subscriptionStatus: SubscriptionStatus.CANCELED,
        stripeSubscriptionId: null,
      });
    });
  });

  describe('invoice.payment_failed', () => {
    it('sets status PAST_DUE when organizationId metadata is present', async () => {
      const event = buildEvent('invoice.payment_failed', {
        object: 'invoice',
        customer: 'cus_x',
        metadata: { organizationId: 'org-4' },
      });

      await useCase.execute(event);

      expect(orgRepo.updates[0].data.subscriptionStatus).toBe(SubscriptionStatus.PAST_DUE);
    });

    it('records the event but skips org update when no organizationId metadata', async () => {
      const event = buildEvent('invoice.payment_failed', {
        object: 'invoice',
        customer: 'cus_x',
        metadata: {},
      });

      await useCase.execute(event);

      expect(orgRepo.updates).toHaveLength(0);
      expect(eventRepo.inserted).toHaveLength(1);
    });
  });

  describe('unhandled event types', () => {
    it('records the event and does not throw', async () => {
      const event = buildEvent('product.created', { object: 'product' });

      const result = await useCase.execute(event);

      expect(result.duplicated).toBe(false);
      expect(eventRepo.inserted).toHaveLength(1);
      expect(orgRepo.updates).toHaveLength(0);
    });
  });
});