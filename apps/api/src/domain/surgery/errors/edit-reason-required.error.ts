// apps/api/src/domain/surgery/errors/edit-reason-required.error.ts

export class EditReasonRequiredError extends Error {
  public readonly code = 'EDIT_REASON_REQUIRED';

  constructor() {
    super('Edit reason is required when modifying a surgery in a terminal state');
    this.name = 'EditReasonRequiredError';
  }
}