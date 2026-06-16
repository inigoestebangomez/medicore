// apps/api/src/domain/shared/rbac-permissions.spec.ts
import type { MemberRole } from '@medicore/contracts';
import { Action, PERMISSIONS, hasPermission } from './rbac-permissions';

describe('RBAC Permissions', () => {
  const roles: MemberRole[] = ['OWNER', 'PHYSICIAN', 'VIEWER', 'ADMIN'];

  describe('PERMISSIONS matrix completeness', () => {
    it('should have an entry for every MemberRole', () => {
      for (const role of roles) {
        expect(PERMISSIONS[role]).toBeDefined();
        expect(PERMISSIONS[role] instanceof Set).toBe(true);
      }
    });

    it('should have every Action listed in at least one role', () => {
      const allActions = Object.values(Action);
      const grantedActions = new Set<Action>();
      for (const role of roles) {
        for (const action of PERMISSIONS[role]) {
          grantedActions.add(action);
        }
      }
      for (const action of allActions) {
        expect(grantedActions.has(action)).toBe(true);
      }
    });
  });

  describe('OWNER permissions', () => {
    it('should have ALL actions', () => {
      const allActions = Object.values(Action);
      const ownerPerms = PERMISSIONS['OWNER'];
      for (const action of allActions) {
        expect(ownerPerms.has(action)).toBe(true);
      }
    });

    it('can delete consultations', () => {
      expect(hasPermission('OWNER', Action.DELETE_CONSULTATION)).toBe(true);
    });

    it('can delete surgeries', () => {
      expect(hasPermission('OWNER', Action.DELETE_SURGERY)).toBe(true);
    });
  });

  describe('PHYSICIAN permissions', () => {
    it('can create and read patients', () => {
      expect(hasPermission('PHYSICIAN', Action.CREATE_PATIENT)).toBe(true);
      expect(hasPermission('PHYSICIAN', Action.READ_PATIENT)).toBe(true);
    });

    it('can update own consultations but not all consultations', () => {
      expect(hasPermission('PHYSICIAN', Action.UPDATE_CONSULTATION_OWN)).toBe(true);
      expect(hasPermission('PHYSICIAN', Action.UPDATE_CONSULTATION_ANY)).toBe(false);
    });

    it('cannot manage members', () => {
      expect(hasPermission('PHYSICIAN', Action.MANAGE_MEMBERS)).toBe(false);
    });

    it('cannot view audit logs', () => {
      expect(hasPermission('PHYSICIAN', Action.VIEW_AUDIT_LOG)).toBe(false);
    });

    it('cannot update organization settings', () => {
      expect(hasPermission('PHYSICIAN', Action.UPDATE_ORGANIZATION)).toBe(false);
    });

    it('can soft-delete patients (BR-RBAC-004)', () => {
      expect(hasPermission('PHYSICIAN', Action.DELETE_PATIENT)).toBe(true);
    });

    it('can delete consultations', () => {
      expect(hasPermission('PHYSICIAN', Action.DELETE_CONSULTATION)).toBe(true);
    });

    it('can delete surgeries', () => {
      expect(hasPermission('PHYSICIAN', Action.DELETE_SURGERY)).toBe(true);
    });
  });

  describe('VIEWER permissions', () => {
    it('can read clinical data', () => {
      expect(hasPermission('VIEWER', Action.READ_PATIENT)).toBe(true);
      expect(hasPermission('VIEWER', Action.READ_CONSULTATION)).toBe(true);
      expect(hasPermission('VIEWER', Action.READ_SURGERY)).toBe(true);
    });

    it('cannot create patients', () => {
      expect(hasPermission('VIEWER', Action.CREATE_PATIENT)).toBe(false);
    });

    it('cannot update consultations', () => {
      expect(hasPermission('VIEWER', Action.UPDATE_CONSULTATION_OWN)).toBe(false);
    });

    it('cannot delete patients', () => {
      expect(hasPermission('VIEWER', Action.DELETE_PATIENT)).toBe(false);
    });

    it('cannot delete consultations', () => {
      expect(hasPermission('VIEWER', Action.DELETE_CONSULTATION)).toBe(false);
    });

    it('cannot delete surgeries', () => {
      expect(hasPermission('VIEWER', Action.DELETE_SURGERY)).toBe(false);
    });

    it('cannot manage members', () => {
      expect(hasPermission('VIEWER', Action.MANAGE_MEMBERS)).toBe(false);
    });
  });

  describe('ADMIN permissions', () => {
    it('can manage members and invitations', () => {
      expect(hasPermission('ADMIN', Action.MANAGE_MEMBERS)).toBe(true);
      expect(hasPermission('ADMIN', Action.CREATE_INVITATION)).toBe(true);
      expect(hasPermission('ADMIN', Action.VIEW_MEMBERS)).toBe(true);
    });

    it('can update organization settings', () => {
      expect(hasPermission('ADMIN', Action.UPDATE_ORGANIZATION)).toBe(true);
    });

    it('cannot access clinical data', () => {
      expect(hasPermission('ADMIN', Action.CREATE_CONSULTATION)).toBe(false);
      expect(hasPermission('ADMIN', Action.CREATE_SURGERY)).toBe(false);
      expect(hasPermission('ADMIN', Action.UPDATE_PATIENT)).toBe(false);
    });

    it('cannot sign reports', () => {
      expect(hasPermission('ADMIN', Action.SIGN_REPORT)).toBe(false);
    });

    it('cannot delete consultations', () => {
      expect(hasPermission('ADMIN', Action.DELETE_CONSULTATION)).toBe(false);
    });

    it('cannot delete surgeries', () => {
      expect(hasPermission('ADMIN', Action.DELETE_SURGERY)).toBe(false);
    });
  });

  describe('hasPermission function', () => {
    it('should return false for unknown roles', () => {
      expect(hasPermission('UNKNOWN' as MemberRole, Action.READ_PATIENT)).toBe(false);
    });

    // Triangulation: test multiple role × action combos
    it.each([
      ['OWNER', Action.DELETE_ORGANIZATION, true],
      ['OWNER', Action.DELETE_CONSULTATION, true],
      ['OWNER', Action.DELETE_SURGERY, true],
      ['PHYSICIAN', Action.CREATE_PATIENT, true],
      ['PHYSICIAN', Action.MANAGE_MEMBERS, false],
      ['PHYSICIAN', Action.DELETE_CONSULTATION, true],
      ['PHYSICIAN', Action.DELETE_SURGERY, true],
      ['VIEWER', Action.READ_PATIENT, true],
      ['VIEWER', Action.CREATE_PATIENT, false],
      ['VIEWER', Action.DELETE_CONSULTATION, false],
      ['VIEWER', Action.DELETE_SURGERY, false],
      ['ADMIN', Action.MANAGE_MEMBERS, true],
      ['ADMIN', Action.CREATE_CONSULTATION, false],
      ['ADMIN', Action.DELETE_CONSULTATION, false],
      ['ADMIN', Action.DELETE_SURGERY, false],
    ] as [string, Action, boolean][])(
      'hasPermission(%s, %s) === %s',
      (role, action, expected) => {
        expect(hasPermission(role as MemberRole, action)).toBe(expected);
      },
    );
  });
});