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
import { normalizeTr } from '@komuta/money';
import {
  createOutletSchema,
  createAliasSchema,
  updateOutletSchema,
  type OutletType,
  type UpdateOutletInput,
} from '@komuta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod-validation.pipe.js';
import { outletScopeWhere, canAccessOutlet } from '../common/scope.js';

@Controller('outlets')
export class OutletsController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermissions('outlet:read')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.outlet.findMany({
      where: { ...outletScopeWhere(user) },
      include: { company: true, brand: true, aliases: true },
      orderBy: { name: 'asc' },
    });
  }

  @RequirePermissions('outlet:create')
  @Post()
  create(
    @Body(new ZodPipe(createOutletSchema))
    body: {
      companyId: string;
      brandId?: string;
      name: string;
      code: string;
      type: OutletType;
      city?: string;
      campus?: string;
      expectsDailyRevenue: boolean;
    },
  ) {
    return this.prisma.outlet.create({ data: body });
  }

  @RequirePermissions('alias:write')
  @Post('alias')
  createAlias(@Body(new ZodPipe(createAliasSchema)) body: { outletId: string; alias: string }) {
    return this.prisma.outletAlias.create({
      data: {
        outletId: body.outletId,
        alias: body.alias,
        normalizedAlias: normalizeTr(body.alias),
      },
    });
  }

  @RequirePermissions('alias:write')
  @Delete('alias/:id')
  async removeAlias(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const alias = await this.prisma.outletAlias.findUnique({
      where: { id },
      include: { outlet: true },
    });
    if (!alias) throw new NotFoundException('Alias not found');
    if (!canAccessOutlet(user, alias.outlet)) {
      throw new ForbiddenException('Outlet outside your scope');
    }
    return this.prisma.outletAlias.delete({ where: { id } });
  }

  @RequirePermissions('outlet:read')
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.prisma.outlet.findFirst({
      where: { id, ...outletScopeWhere(user) },
      include: { company: true, brand: true, aliases: true },
    });
  }

  @RequirePermissions('outlet:update')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateOutletSchema)) body: UpdateOutletInput,
  ) {
    const outlet = await this.prisma.outlet.findUnique({ where: { id } });
    if (!outlet) throw new NotFoundException('Outlet not found');
    if (!canAccessOutlet(user, outlet)) {
      throw new ForbiddenException('Outlet outside your scope');
    }
    if (body.code !== undefined && body.code !== outlet.code) {
      const clash = await this.prisma.outlet.findUnique({ where: { code: body.code } });
      if (clash) throw new ConflictException(`Outlet code "${body.code}" is already in use`);
    }
    if (body.brandId) {
      const brand = await this.prisma.brand.findUnique({ where: { id: body.brandId } });
      if (!brand || brand.companyId !== outlet.companyId) {
        throw new ConflictException('Brand does not belong to the outlet company');
      }
    }
    return this.prisma.outlet.update({
      where: { id },
      data: {
        name: body.name,
        code: body.code,
        type: body.type,
        city: body.city,
        campus: body.campus,
        brandId: body.brandId,
        expectsDailyRevenue: body.expectsDailyRevenue,
        isActive: body.isActive,
      },
      include: { company: true, brand: true, aliases: true },
    });
  }

  /**
   * Delete an outlet. If any operational data exists (revenue/accounting rows),
   * the outlet is soft-deleted (isActive=false, expectsDailyRevenue=false) so
   * history keeps its foreign keys; hard delete only when it never traded.
   */
  @RequirePermissions('outlet:delete')
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            revenueEntries: true,
            inventory: true,
            payroll: true,
            purchases: true,
            studentCounts: true,
            headcounts: true,
          },
        },
      },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');
    if (!canAccessOutlet(user, outlet)) {
      throw new ForbiddenException('Outlet outside your scope');
    }
    const c = outlet._count;
    const hasData =
      c.revenueEntries + c.inventory + c.payroll + c.purchases + c.studentCounts + c.headcounts >
      0;
    if (hasData) {
      const updated = await this.prisma.outlet.update({
        where: { id },
        data: { isActive: false, expectsDailyRevenue: false },
      });
      return { soft: true, outlet: updated };
    }
    const deleted = await this.prisma.outlet.delete({ where: { id } });
    return { soft: false, outlet: deleted };
  }
}
