import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Role, Permission } from '@komuta/shared';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  permissions: Permission[];
  scopeCompanyIds: string[];
  scopeOutletIds: string[];
  /** OWNER/ADMIN see everything regardless of scope rows. */
  unscoped: boolean;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser;
  },
);
