import { describe, it, expect } from 'vitest';
import { canAssignRole, hasPermission, resolvePermissions } from './permissions.js';
import { Role } from './enums.js';

describe('canAssignRole — no privilege escalation via user:create', () => {
  it('only OWNER may create another OWNER', () => {
    expect(canAssignRole(Role.OWNER, Role.OWNER)).toBe(true);
    expect(canAssignRole(Role.ADMIN, Role.OWNER)).toBe(false);
    expect(canAssignRole(Role.ACCOUNTANT, Role.OWNER)).toBe(false);
    expect(canAssignRole(Role.MANAGER, Role.OWNER)).toBe(false);
    expect(canAssignRole(Role.VIEWER, Role.OWNER)).toBe(false);
  });

  it('ACCOUNTANT may not create ADMIN users', () => {
    expect(canAssignRole(Role.ACCOUNTANT, Role.ADMIN)).toBe(false);
  });

  it('roles may create peers and below', () => {
    expect(canAssignRole(Role.ADMIN, Role.ADMIN)).toBe(true);
    expect(canAssignRole(Role.ADMIN, Role.ACCOUNTANT)).toBe(true);
    expect(canAssignRole(Role.ACCOUNTANT, Role.ACCOUNTANT)).toBe(true);
    expect(canAssignRole(Role.ACCOUNTANT, Role.MANAGER)).toBe(true);
    expect(canAssignRole(Role.ACCOUNTANT, Role.VIEWER)).toBe(true);
    expect(canAssignRole(Role.OWNER, Role.VIEWER)).toBe(true);
  });

  it('lower roles may not create higher ones', () => {
    expect(canAssignRole(Role.MANAGER, Role.ACCOUNTANT)).toBe(false);
    expect(canAssignRole(Role.VIEWER, Role.MANAGER)).toBe(false);
  });
});

describe('resolvePermissions', () => {
  it('grants add and revokes remove', () => {
    const set = resolvePermissions(Role.VIEWER, ['revenue:write'], ['dashboard:read']);
    expect(set.has('revenue:write')).toBe(true);
    expect(set.has('dashboard:read')).toBe(false);
    expect(set.has('company:read')).toBe(true);
  });

  it('ADMIN lacks company:delete, OWNER has it', () => {
    expect(hasPermission(Role.ADMIN, 'company:delete')).toBe(false);
    expect(hasPermission(Role.OWNER, 'company:delete')).toBe(true);
  });

  it('ACCOUNTANT holds the brief-specified writes but no mapping:approve', () => {
    expect(hasPermission(Role.ACCOUNTANT, 'payroll:write')).toBe(true);
    expect(hasPermission(Role.ACCOUNTANT, 'inventory:write')).toBe(true);
    expect(hasPermission(Role.ACCOUNTANT, 'mapping:approve')).toBe(false);
  });
});
