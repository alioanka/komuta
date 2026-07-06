import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { createRevenueSchema } from '@komuta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod-validation.pipe.js';
import { canAccessOutlet, outletScopeWhere } from '../common/scope.js';
import { dateOnly } from '../common/date.util.js';

/** Validate an optional YYYY-MM-DD query param before it reaches Prisma. */
function dateParam(value: string | undefined, name: string): Date | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${name} must be YYYY-MM-DD`);
  }
  return dateOnly(value);
}

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
    const gte = dateParam(from, 'from');
    const lte = dateParam(to, 'to');
    if (gte || lte) {
      where.businessDate = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
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
    const outlet = await this.prisma.outlet.findUnique({ where: { id: body.outletId } });
    if (!outlet) throw new NotFoundException('Outlet not found');
    if (!canAccessOutlet(user, outlet)) {
      throw new ForbiddenException('Outlet outside your scope');
    }
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
    const entry = await this.prisma.revenueEntry.findUnique({
      where: { id },
      include: { outlet: true },
    });
    if (!entry) throw new NotFoundException('Entry not found');
    if (!canAccessOutlet(user, entry.outlet)) {
      throw new ForbiddenException('Outlet outside your scope');
    }
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
