// packages/contracts/src/member.schema.ts
import { z } from 'zod';

export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'PHYSICIAN', 'VIEWER', 'ADMIN']),
});
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'PHYSICIAN', 'VIEWER', 'ADMIN']),
});
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;