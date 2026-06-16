// packages/contracts/src/invitation.schema.ts
import { z } from 'zod';

export const AcceptInvitationSchema = z.object({
  token: z.string().min(1),
});
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationSchema>;

export const InvitationResponseSchema = z.object({
  invitationId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['OWNER', 'PHYSICIAN', 'VIEWER', 'ADMIN']),
  expiresAt: z.string(),
});
export type InvitationResponse = z.infer<typeof InvitationResponseSchema>;