import { Body, Controller, Get, Post } from '@nestjs/common';
import { createCompanySchema, createBrandSchema } from '@komuta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod-validation.pipe.js';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Controller('companies')
export class CompaniesController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermissions('company:read')
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const where = user.unscoped
      ? {}
      : user.scopeCompanyIds.length > 0
        ? { id: { in: user.scopeCompanyIds } }
        : { id: '__none__' };
    return this.prisma.company.findMany({
      where,
      include: { brands: true, _count: { select: { outlets: true } } },
      orderBy: { name: 'asc' },
    });
  }

  @RequirePermissions('company:create')
  @Post()
  create(@Body(new ZodPipe(createCompanySchema)) body: { name: string; slug?: string }) {
    return this.prisma.company.create({
      data: { name: body.name, slug: body.slug ?? slugify(body.name) },
    });
  }

  @RequirePermissions('brand:create')
  @Post('brand')
  createBrand(
    @Body(new ZodPipe(createBrandSchema)) body: { companyId: string; name: string; slug?: string },
  ) {
    return this.prisma.brand.create({
      data: { companyId: body.companyId, name: body.name, slug: body.slug ?? slugify(body.name) },
    });
  }
}
