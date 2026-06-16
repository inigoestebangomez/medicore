import { z } from 'zod';

// ─────────────────────────────────────────────
// Enums (mirrors Prisma MemberRole)
// ─────────────────────────────────────────────

export const MemberRoleSchema = z.enum([
  'OWNER',
  'PHYSICIAN',
  'VIEWER',
  'ADMIN',
]);

export type MemberRole = z.infer<typeof MemberRoleSchema>;

// ─────────────────────────────────────────────
// JWT Payload — shared between Auth.js and NestJS
// ─────────────────────────────────────────────

export const JwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  organizationId: z.string().uuid(),
  role: MemberRoleSchema,
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

// ─────────────────────────────────────────────
// User Profile — returned by /auth/me
// ─────────────────────────────────────────────

export const MembershipSchema = z.object({
  organizationId: z.string().uuid(),
  organizationName: z.string().min(1),
  role: MemberRoleSchema,
});

export type Membership = z.infer<typeof MembershipSchema>;

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  memberships: z.array(MembershipSchema),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

// ─────────────────────────────────────────────
// Switch Organization — POST /auth/switch-organization
// ─────────────────────────────────────────────

export const SwitchOrganizationSchema = z.object({
  organizationId: z.string().uuid(),
});

export type SwitchOrganizationInput = z.infer<typeof SwitchOrganizationSchema>;

// ─────────────────────────────────────────────
// Auth Profile — from OAuth provider
// ─────────────────────────────────────────────

export const AuthProfileSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  oauthProvider: z.enum(['google', 'microsoft']),
  oauthSub: z.string().min(1),
});

export type AuthProfile = z.infer<typeof AuthProfileSchema>;