import { Body, Controller, Get, Post, Param } from '@nestjs/common';
import { normalizeTr } from '@komuta/money';
import { createOutletSchema, createAliasSchema, type OutletType } from '@komuta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod-validation.pipe.js';
import { outletScopeWhere } from '../common/scope.js';

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

  @RequirePermissions('outlet:read')
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.prisma.outlet.findFirst({
      where: { id, ...outletScopeWhere(user) },
      include: { company: true, brand: true, aliases: true },
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
}
