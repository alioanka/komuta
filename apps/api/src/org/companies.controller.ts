import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  createCompanySchema,
  createBrandSchema,
  updateCompanySchema,
  updateBrandSchema,
  type UpdateCompanyInput,
  type UpdateBrandInput,
} from '@komuta/shared';
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

  @RequirePermissions('brand:update')
  @Patch('brand/:id')
  async updateBrand(
    @Param('id') id: string,
    @Body(new ZodPipe(updateBrandSchema)) body: UpdateBrandInput,
  ) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');
    return this.prisma.brand.update({ where: { id }, data: { name: body.name } });
  }

  @RequirePermissions('brand:update')
  @Delete('brand/:id')
  async removeBrand(@Param('id') id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { outlets: true } } },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    if (brand._count.outlets > 0) {
      throw new ConflictException('Brand still has outlets attached; reassign them first');
    }
    return this.prisma.brand.delete({ where: { id } });
  }

  @RequirePermissions('company:update')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodPipe(updateCompanySchema)) body: UpdateCompanyInput,
  ) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');
    return this.prisma.company.update({
      where: { id },
      data: { name: body.name, isActive: body.isActive },
    });
  }

  /** Hard delete — OWNER only (via company:delete). Refused while outlets exist. */
  @RequirePermissions('company:delete')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { _count: { select: { outlets: true } } },
    });
    if (!company) throw new NotFoundException('Company not found');
    if (company._count.outlets > 0) {
      throw new ConflictException('Company still has outlets; delete or move them first');
    }
    return this.prisma.company.delete({ where: { id } });
  }
}
