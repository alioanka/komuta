import { Body, Controller, Get, Post, Param, Query } from '@nestjs/common';
import { createRevenueSchema } from '@komuta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod-validation.pipe.js';
import { outletScopeWhere } from '../common/scope.js';
import { dateOnly } from '../common/date.util.js';

@Controller('revenue')
export class RevenueController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermissions('revenue:read')
  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('outletId') outletId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const scopedOutlets = await this.prisma.outlet.findMany({
      where: outletScopeWhere(user),
      select: { id: true },
    });
    const allowed = new Set(scopedOutlets.map((o) => o.id));
    const where: Record<string, unknown> = {
      outletId: outletId && allowed.has(outletId) ? outletId : { in: [...allowed] },
    };
    if (from || to) {
      where.businessDate = {
        ...(from ? { gte: dateOnly(from) } : {}),
        ...(to ? { lte: dateOnly(to) } : {}),
      };
    }
    return this.prisma.revenueEntry.findMany({
      where,
      orderBy: { businessDate: 'desc' },
      take: 200,
    });
  }

  @RequirePermissions('revenue:write')
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createRevenueSchema))
    body: { outletId: string; businessDate: string; amount: string; note?: string },
  ) {
    const businessDate = dateOnly(body.businessDate);
    await this.prisma.revenueEntry.updateMany({
      where: { outletId: body.outletId, businessDate, status: 'CONFIRMED' },
      data: { status: 'SUPERSEDED' },
    });
    return this.prisma.revenueEntry.create({
      data: {
        outletId: body.outletId,
        businessDate,
        amount: body.amount,
        source: 'MANUAL',
        status: 'CONFIRMED',
        enteredByUserId: user.id,
        note: body.note,
      },
    });
  }

  @RequirePermissions('revenue:write')
  @Post(':id/approve')
  async approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const entry = await this.prisma.revenueEntry.findUnique({ where: { id } });
    if (!entry) return { ok: false };
    await this.prisma.revenueEntry.updateMany({
      where: { outletId: entry.outletId, businessDate: entry.businessDate, status: 'CONFIRMED' },
      data: { status: 'SUPERSEDED' },
    });
    return this.prisma.revenueEntry.update({
      where: { id },
      data: { status: 'CONFIRMED', enteredByUserId: user.id },
    });
  }
}
