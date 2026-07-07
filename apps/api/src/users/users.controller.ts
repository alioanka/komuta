import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  canAssignRole,
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  type CreateUserInput,
  type UpdateUserInput,
} from '@komuta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod-validation.pipe.js';

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phoneE164: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  grantedPermissions: true,
  revokedPermissions: true,
  scopes: {
    select: {
      id: true,
      companyId: true,
      outletId: true,
      company: { select: { id: true, name: true } },
      outlet: { select: { id: true, name: true, code: true } },
    },
  },
} satisfies Prisma.UserSelect;

function isUniqueViolation(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  @RequirePermissions('user:read')
  @Get()
  list() {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Permission catalog + role defaults so the UI can render a permission editor. */
  @RequirePermissions('user:read')
  @Get('permissions')
  permissions() {
    return { permissions: PERMISSIONS, rolePermissions: ROLE_PERMISSIONS };
  }

  @RequirePermissions('user:create')
  @Post()
  async create(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodPipe(createUserSchema)) body: CreateUserInput,
  ) {
    // user:create must never be a privilege-escalation path (e.g. an
    // ACCOUNTANT creating an OWNER account).
    if (!canAssignRole(actor.role, body.role)) {
      throw new ForbiddenException(`Role ${actor.role} may not create ${body.role} users`);
    }
    const passwordHash = await this.auth.hashPassword(body.password);
    const scopes = [
      ...(body.scopeCompanyIds ?? []).map((companyId) => ({ companyId })),
      ...(body.scopeOutletIds ?? []).map((outletId) => ({ outletId })),
    ];
    try {
      return await this.prisma.user.create({
        data: {
          email: body.email.toLowerCase(),
          fullName: body.fullName,
          role: body.role,
          phoneE164: body.phoneE164 ?? null,
          passwordHash,
          scopes: { create: scopes },
        },
        select: { id: true, email: true, fullName: true, role: true, phoneE164: true },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('A user with this email or phone already exists');
      }
      throw e;
    }
  }

  @RequirePermissions('user:update')
  @Patch(':id')
  async update(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updateUserSchema)) body: UpdateUserInput,
  ) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');

    // The actor must outrank (or match) the target to manage them at all.
    if (!canAssignRole(actor.role, target.role)) {
      throw new ForbiddenException(`Role ${actor.role} may not manage ${target.role} users`);
    }
    if (body.role !== undefined && !canAssignRole(actor.role, body.role)) {
      throw new ForbiddenException(`Role ${actor.role} may not assign ${body.role}`);
    }
    // Self-guards: you cannot lock yourself out or change your own role.
    if (id === actor.id) {
      if (body.isActive === false) {
        throw new ForbiddenException('You cannot deactivate your own account');
      }
      if (body.role !== undefined && body.role !== target.role) {
        throw new ForbiddenException('You cannot change your own role');
      }
    }
    // Demoting/deactivating the last active OWNER would brick the system.
    if (
      target.role === 'OWNER' &&
      target.isActive &&
      ((body.role !== undefined && body.role !== 'OWNER') || body.isActive === false)
    ) {
      const owners = await this.prisma.user.count({ where: { role: 'OWNER', isActive: true } });
      if (owners <= 1) throw new ConflictException('Cannot demote or deactivate the last OWNER');
    }

    const replaceScopes =
      body.scopeCompanyIds !== undefined || body.scopeOutletIds !== undefined;
    const scopes = [
      ...(body.scopeCompanyIds ?? []).map((companyId) => ({ companyId })),
      ...(body.scopeOutletIds ?? []).map((outletId) => ({ outletId })),
    ];

    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          fullName: body.fullName,
          role: body.role,
          isActive: body.isActive,
          phoneE164: body.phoneE164,
          grantedPermissions: body.grantedPermissions,
          revokedPermissions: body.revokedPermissions,
          ...(replaceScopes ? { scopes: { deleteMany: {}, create: scopes } } : {}),
        },
        select: USER_SELECT,
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Another user already has this phone number');
      }
      throw e;
    }
  }

  @RequirePermissions('user:update')
  @Post(':id/reset-password')
  async resetPassword(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(resetPasswordSchema)) body: { newPassword: string },
  ) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (!canAssignRole(actor.role, target.role)) {
      throw new ForbiddenException(`Role ${actor.role} may not manage ${target.role} users`);
    }
    const passwordHash = await this.auth.hashPassword(body.newPassword);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.auth.logout(id); // revoke all refresh tokens
    return { ok: true };
  }

  /** Soft delete: deactivate + revoke sessions. History (audit, entries) stays. */
  @RequirePermissions('user:delete')
  @Delete(':id')
  async remove(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    if (id === actor.id) throw new ForbiddenException('You cannot delete your own account');
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (!canAssignRole(actor.role, target.role)) {
      throw new ForbiddenException(`Role ${actor.role} may not manage ${target.role} users`);
    }
    if (target.role === 'OWNER' && target.isActive) {
      const owners = await this.prisma.user.count({ where: { role: 'OWNER', isActive: true } });
      if (owners <= 1) throw new ConflictException('Cannot delete the last OWNER');
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, email: true, isActive: true },
    });
    await this.auth.logout(id);
    return user;
  }
}
