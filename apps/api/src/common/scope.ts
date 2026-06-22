import type { AuthUser } from './current-user.decorator.js';

/**
 * Build a Prisma `where` fragment that restricts Outlet queries to the user's
 * scope. OWNER/ADMIN (unscoped) see everything; others are limited to their
 * scoped companies/outlets.
 */
export function outletScopeWhere(user: AuthUser): Record<string, unknown> {
  if (user.unscoped) return {};
  const or: Record<string, unknown>[] = [];
  if (user.scopeOutletIds.length > 0) or.push({ id: { in: user.scopeOutletIds } });
  if (user.scopeCompanyIds.length > 0) or.push({ companyId: { in: user.scopeCompanyIds } });
  // No scope rows → see nothing.
  if (or.length === 0) return { id: '__none__' };
  return { OR: or };
}

/** True if the user may act on a given outlet/company. */
export function canAccessOutlet(
  user: AuthUser,
  outlet: { id: string; companyId: string },
): boolean {
  if (user.unscoped) return true;
  return (
    user.scopeOutletIds.includes(outlet.id) || user.scopeCompanyIds.includes(outlet.companyId)
  );
}
