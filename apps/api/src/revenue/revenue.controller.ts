import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  createRevenueSchema,
  updateRevenueSchema,
  revenueImportSchema,
  type EntryStatus,
  type UpdateRevenueInput,
  type RevenueImportInput,
} from '@komuta/shared';
import { parseAmount } from '@komuta/money';
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

  /**
   * List entries. Legacy shape (plain array, latest 200) is kept for callers
   * that pass no pagination; `?page=`/`?pageSize=` switches to {items,total}.
   * `?status=` filters explicitly (incl. PENDING_REVIEW/SUPERSEDED/REJECTED);
   * without it, all statuses are returned as before.
   */
  @RequirePermissions('revenue:read')
  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('outletId') outletId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const scopedOutlets = await this.prisma.outlet.findMany({
      where: outletScopeWhere(user),
      select: { id: true },
    });
    const allowed = new Set(scopedOutlets.map((o) => o.id));
    const where: Record<string, unknown> = {
      outletId: outletId && allowed.has(outletId) ? outletId : { in: [...allowed] },
    };
    if (status) {
      const valid: EntryStatus[] = ['CONFIRMED', 'PENDING_REVIEW', 'REJECTED', 'SUPERSEDED'];
      if (!valid.includes(status as EntryStatus)) {
        throw new BadRequestException(`status must be one of ${valid.join(', ')}`);
      }
      where.status = status;
    }
    const gte = dateParam(from, 'from');
    const lte = dateParam(to, 'to');
    if (gte || lte) {
      where.businessDate = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
    }
    const orderBy = [{ businessDate: 'desc' as const }, { createdAt: 'desc' as const }];

    if (page !== undefined || pageSize !== undefined) {
      const p = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
      const size = Math.min(200, Math.max(1, Number.parseInt(pageSize ?? '50', 10) || 50));
      const [items, total] = await Promise.all([
        this.prisma.revenueEntry.findMany({
          where,
          orderBy,
          skip: (p - 1) * size,
          take: size,
          include: { outlet: { select: { id: true, name: true, code: true } } },
        }),
        this.prisma.revenueEntry.count({ where }),
      ]);
      return { items, total, page: p, pageSize: size };
    }

    return this.prisma.revenueEntry.findMany({ where, orderBy, take: 200 });
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

  /**
   * Bulk historical import. Each row is resolved by outlet `code`, scope-checked
   * and amount-parsed independently; a single bad row never aborts the batch —
   * failures are accumulated and reported. CONFIRMED rows supersede the prior
   * confirmed entry for their (outlet, businessDate), matching manual create.
   */
  @RequirePermissions('revenue:write')
  @Post('import')
  async import(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(revenueImportSchema)) body: RevenueImportInput,
  ) {
    const scopedOutlets = await this.prisma.outlet.findMany({
      where: outletScopeWhere(user),
      select: { id: true, code: true },
    });
    const byCode = new Map(scopedOutlets.map((o) => [o.code, o.id]));

    let imported = 0;
    let skipped = 0;
    const errors: { row: number; storeCode: string; reason: string }[] = [];

    for (let i = 0; i < body.rows.length; i++) {
      const row = body.rows[i]!;
      try {
        const outletId = byCode.get(row.storeCode);
        if (!outletId) {
          skipped++;
          errors.push({ row: i, storeCode: row.storeCode, reason: 'Unknown or out-of-scope store code' });
          continue;
        }
        const raw = typeof row.amount === 'number' ? String(row.amount) : row.amount;
        const parsed = parseAmount(raw);
        if (parsed.status !== 'OK' || !parsed.normalized) {
          skipped++;
          errors.push({ row: i, storeCode: row.storeCode, reason: `Unparseable amount (${parsed.status})` });
          continue;
        }
        const businessDate = dateOnly(row.date);
        const status = body.defaultStatus;
        if (status === 'CONFIRMED') {
          await this.prisma.revenueEntry.updateMany({
            where: { outletId, businessDate, status: 'CONFIRMED' },
            data: { status: 'SUPERSEDED' },
          });
        }
        await this.prisma.revenueEntry.create({
          data: {
            outletId,
            businessDate,
            amount: parsed.normalized,
            source: 'IMPORT',
            status,
            enteredByUserId: user.id,
          },
        });
        imported++;
      } catch (err) {
        skipped++;
        errors.push({
          row: i,
          storeCode: row.storeCode,
          reason: err instanceof Error ? err.message : 'Unexpected error',
        });
      }
    }

    return { imported, skipped, errors };
  }

  /**
   * Edit a single entry. If the entry ends up CONFIRMED (status set to
   * CONFIRMED, or it already was and amount/date changed), the one-CONFIRMED-
   * per-(outlet, day) invariant is re-applied for the (possibly new) day.
   */
  @RequirePermissions('revenue:write')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateRevenueSchema)) body: UpdateRevenueInput,
  ) {
    const entry = await this.prisma.revenueEntry.findUnique({
      where: { id },
      include: { outlet: true },
    });
    if (!entry) throw new NotFoundException('Entry not found');
    if (!canAccessOutlet(user, entry.outlet)) {
      throw new ForbiddenException('Outlet outside your scope');
    }
    const businessDate = body.businessDate ? dateOnly(body.businessDate) : entry.businessDate;
    const finalStatus = body.status ?? entry.status;
    if (finalStatus === 'CONFIRMED') {
      await this.prisma.revenueEntry.updateMany({
        where: {
          outletId: entry.outletId,
          businessDate,
          status: 'CONFIRMED',
          id: { not: id },
        },
        data: { status: 'SUPERSEDED' },
      });
    }
    return this.prisma.revenueEntry.update({
      where: { id },
      data: {
        amount: body.amount,
        businessDate: body.businessDate ? businessDate : undefined,
        note: body.note,
        status: body.status,
        enteredByUserId: user.id,
      },
    });
  }

  @RequirePermissions('revenue:write')
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const entry = await this.prisma.revenueEntry.findUnique({
      where: { id },
      include: { outlet: true },
    });
    if (!entry) throw new NotFoundException('Entry not found');
    if (!canAccessOutlet(user, entry.outlet)) {
      throw new ForbiddenException('Outlet outside your scope');
    }
    return this.prisma.revenueEntry.delete({ where: { id } });
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
