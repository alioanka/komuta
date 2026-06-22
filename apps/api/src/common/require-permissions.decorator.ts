import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@komuta/shared';

export const PERMISSIONS_KEY = 'requiredPermissions';
/** Require the caller to hold ALL listed permissions (enforced by PermissionsGuard). */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
