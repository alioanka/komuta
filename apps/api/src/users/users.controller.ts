import { Body, Controller, Get, Post } from '@nestjs/common';
import { createUserSchema, type Role } from '@komuta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { ZodPipe } from '../common/zod-validation.pipe.js';

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
      select: { id: true, email: true, fullName: true, role: true, isActive: true, lastLoginAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  @RequirePermissions('user:create')
  @Post()
  async create(
    @Body(new ZodPipe(createUserSchema))
    body: {
      email: string;
      fullName: string;
      role: Role;
      password: string;
      scopeCompanyIds?: string[];
      scopeOutletIds?: string[];
    },
  ) {
    const passwordHash = await this.auth.hashPassword(body.password);
    const scopes = [
      ...(body.scopeCompanyIds ?? []).map((companyId) => ({ companyId })),
      ...(body.scopeOutletIds ?? []).map((outletId) => ({ outletId })),
    ];
    const user = await this.prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        fullName: body.fullName,
        role: body.role,
        passwordHash,
        scopes: { create: scopes },
      },
      select: { id: true, email: true, fullName: true, role: true },
    });
    return user;
  }
}
