// apps/api/src/domain/surgery/index.ts
export { Surgery } from './surgery.entity';
export type { SurgeryProps } from './surgery.entity';
export { SurgeryNotFoundError } from './errors/surgery-not-found.error';
export { InvalidSurgeryTransitionError } from './errors/invalid-surgery-transition.error';
export { AsaRequiredError } from './errors/asa-required.error';
export { EditReasonRequiredError } from './errors/edit-reason-required.error';
export { InvalidProcedureCodeError } from './errors/invalid-procedure-code.error';
export type { ISurgeryRepository, ListSurgeriesParams, CreateSurgeryInput, UpdateSurgeryInput } from './surgery.repository.interface';