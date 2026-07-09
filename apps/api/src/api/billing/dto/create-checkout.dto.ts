// apps/api/src/api/billing/dto/create-checkout.dto.ts
// DTOs mirror packages/contracts billing schemas; validated inline via
// ZodValidationPipe in the controller.

export interface CreateCheckoutDto {
  billingInterval: 'MONTHLY' | 'YEARLY';
}

export interface CreatePortalDto {
  // no body
}