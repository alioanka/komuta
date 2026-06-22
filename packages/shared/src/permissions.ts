import { Role } from './enums.js';

/**
 * RBAC permissions, keyed as `resource:action`. Roles map to permission sets;
 * per-user overrides are supported in the DB layer (UserScope / overrides).
 * See the brief §6.5 — ACCOUNTANT (Salih) gets exactly the listed permissions.
 */
export const PERMISSIONS = [
  'company:read',
  'company:create',
  'company:update',
  'company:delete',
  'brand:create',
  'brand:update',
  'outlet:read',
  'outlet:create',
  'outlet:update',
  'outlet:delete',
  'alias:write',
  'employee:write',
  'user:read',
  'user:create',
  'user:update',
  'user:delete',
  'mapping:read',
  'mapping:approve',
  'revenue:read',
  'revenue:write',
  'payroll:write',
  'purchases:write',
  'inventory:write',
  'studentCount:write',
  'headcount:write',
  'dashboard:read',
  'monitor:read',
  'message:read',
  'message:send',
  'template:manage',
  'notification:read',
  'notification:manage',
  'settings:manage',
  'audit:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

const READ_ONLY: Permission[] = [
  'company:read',
  'outlet:read',
  'revenue:read',
  'dashboard:read',
  'monitor:read',
  'message:read',
  'notification:read',
  'mapping:read',
];

/** ACCOUNTANT = exactly what the brief specifies for Salih, plus read dashboards. */
const ACCOUNTANT: Permission[] = [
  ...READ_ONLY,
  'user:read',
  'user:create',
  'company:create',
  'outlet:create',
  'brand:create',
  'payroll:write',
  'purchases:write',
  'inventory:write',
  'studentCount:write',
  'headcount:write',
];

/** MANAGER = read + confirm pending mappings/entries + send messages (scoped). */
const MANAGER: Permission[] = [
  ...READ_ONLY,
  'mapping:approve',
  'revenue:write',
  'message:send',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.OWNER]: ALL,
  // ADMIN: everything except owner-only destructive deletes of companies.
  [Role.ADMIN]: ALL.filter((p) => p !== 'company:delete'),
  [Role.ACCOUNTANT]: ACCOUNTANT,
  [Role.MANAGER]: MANAGER,
  [Role.VIEWER]: READ_ONLY,
};

/** Resolve the effective permission set for a role plus optional per-user grants/revokes. */
export function resolvePermissions(
  role: Role,
  grants: Permission[] = [],
  revokes: Permission[] = [],
): Set<Permission> {
  const set = new Set<Permission>(ROLE_PERMISSIONS[role]);
  for (const g of grants) set.add(g);
  for (const r of revokes) set.delete(r);
  return set;
}

export function hasPermission(
  role: Role,
  permission: Permission,
  grants: Permission[] = [],
  revokes: Permission[] = [],
): boolean {
  return resolvePermissions(role, grants, revokes).has(permission);
}
