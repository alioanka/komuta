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
  Query,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  payrollSchema,
  purchaseSchema,
  inventorySchema,
  studentCountSchema,
  headcountSchema,
  updatePayrollSchema,
  updatePurchaseSchema,
  updateInventorySchema,
  updateStudentCountSchema,
  updateHeadcountSchema,
  type UpdatePayrollInput,
  type UpdatePurchaseInput,
  type UpdateInventoryInput,
  type UpdateStudentCountInput,
  type UpdateHeadcountInput,
} from '@komuta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod-validation.pipe.js';
import { dateOnly } from '../common/date.util.js';
import { canAccessOutlet, outletScopeWhere } from '../common/scope.js';

const OUTLET_INCLUDE = {
  outlet: { select: { id: true, companyId: true, name: true, code: true } },
} as const;

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

/** Monthly accounting entries — upsert by (outletId, period). Salih's area. */
@Controller('accounting')
export class AccountingController {
  constructor(private readonly prisma: PrismaService) {}

  // ---- helpers -------------------------------------------------------------

  /** Scoped list filter: optional explicit outlet + the caller's outlet scope. */
  private listWhere(user: AuthUser, outletId?: string) {
    return { ...(outletId ? { outletId } : {}), outlet: outletScopeWhere(user) };
  }

  /** Load a row by id from `model`, 404 when missing, 403 when out of scope. */
  private async loadScoped<T extends { outlet: { id: string; companyId: string } }>(
    user: AuthUser,
    find: (args: { where: { id: string }; include: typeof OUTLET_INCLUDE }) => Promise<T | null>,
    id: string,
  ): Promise<T> {
    const row = await find({ where: { id }, include: OUTLET_INCLUDE });
    if (!row) throw new NotFoundException('Entry not found');
    if (!canAccessOutlet(user, row.outlet)) {
      throw new ForbiddenException('Outlet outside your scope');
    }
    return row;
  }

  private conflict409(e: unknown): never {
    if (isUniqueViolation(e)) {
      throw new ConflictException('An entry for this outlet and period already exists');
    }
    throw e;
  }

  // ---- Payroll ---------------------------------------------------------------

  @RequirePermissions('outlet:read')
  @Get('payroll')
  listPayroll(@CurrentUser() user: AuthUser, @Query('outletId') outletId?: string) {
    return this.prisma.payrollEntry.findMany({
      where: this.listWhere(user, outletId),
      include: OUTLET_INCLUDE,
      orderBy: [{ periodMonth: 'desc' }, { createdAt: 'desc' }],
    });
  }

  @RequirePermissions('payroll:write')
  @Post('payroll')
  payroll(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(payrollSchema))
    body: { outletId: string; periodMonth: string; totalSalary: string; employeeCount?: number },
  ) {
    return this.prisma.payrollEntry.upsert({
      where: { outletId_periodMonth: { outletId: body.outletId, periodMonth: body.periodMonth } },
      create: { ...body, enteredByUserId: user.id },
      update: { totalSalary: body.totalSalary, employeeCount: body.employeeCount, enteredByUserId: user.id },
    });
  }

  @RequirePermissions('payroll:write')
  @Patch('payroll/:id')
  async updatePayroll(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updatePayrollSchema)) body: UpdatePayrollInput,
  ) {
    await this.loadScoped(user, (a) => this.prisma.payrollEntry.findUnique(a), id);
    try {
      return await this.prisma.payrollEntry.update({
        where: { id },
        data: { ...body, enteredByUserId: user.id },
      });
    } catch (e) {
      this.conflict409(e);
    }
  }

  @RequirePermissions('payroll:write')
  @Delete('payroll/:id')
  async deletePayroll(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.loadScoped(user, (a) => this.prisma.payrollEntry.findUnique(a), id);
    return this.prisma.payrollEntry.delete({ where: { id } });
  }

  // ---- Purchases -------------------------------------------------------------

  @RequirePermissions('outlet:read')
  @Get('purchases')
  listPurchases(@CurrentUser() user: AuthUser, @Query('outletId') outletId?: string) {
    return this.prisma.purchaseEntry.findMany({
      where: this.listWhere(user, outletId),
      include: OUTLET_INCLUDE,
      orderBy: [{ periodMonth: 'desc' }, { createdAt: 'desc' }],
    });
  }

  @RequirePermissions('purchases:write')
  @Post('purchases')
  purchases(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(purchaseSchema))
    body: { outletId: string; periodMonth: string; amount: string; note?: string },
  ) {
    return this.prisma.purchaseEntry.upsert({
      where: { outletId_periodMonth: { outletId: body.outletId, periodMonth: body.periodMonth } },
      create: { ...body, enteredByUserId: user.id },
      update: { amount: body.amount, note: body.note, enteredByUserId: user.id },
    });
  }

  @RequirePermissions('purchases:write')
  @Patch('purchases/:id')
  async updatePurchase(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updatePurchaseSchema)) body: UpdatePurchaseInput,
  ) {
    await this.loadScoped(user, (a) => this.prisma.purchaseEntry.findUnique(a), id);
    try {
      return await this.prisma.purchaseEntry.update({
        where: { id },
        data: { ...body, enteredByUserId: user.id },
      });
    } catch (e) {
      this.conflict409(e);
    }
  }

  @RequirePermissions('purchases:write')
  @Delete('purchases/:id')
  async deletePurchase(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.loadScoped(user, (a) => this.prisma.purchaseEntry.findUnique(a), id);
    return this.prisma.purchaseEntry.delete({ where: { id } });
  }

  // ---- Inventory -------------------------------------------------------------

  @RequirePermissions('outlet:read')
  @Get('inventory')
  listInventory(@CurrentUser() user: AuthUser, @Query('outletId') outletId?: string) {
    return this.prisma.inventorySnapshot.findMany({
      where: this.listWhere(user, outletId),
      include: OUTLET_INCLUDE,
      orderBy: [{ asOfDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  @RequirePermissions('inventory:write')
  @Post('inventory')
  inventory(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(inventorySchema))
    body: { outletId: string; asOfDate: string; stockValue: string; note?: string },
  ) {
    return this.prisma.inventorySnapshot.create({
      data: {
        outletId: body.outletId,
        asOfDate: dateOnly(body.asOfDate),
        stockValue: body.stockValue,
        note: body.note,
        enteredByUserId: user.id,
      },
    });
  }

  @RequirePermissions('inventory:write')
  @Patch('inventory/:id')
  async updateInventory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updateInventorySchema)) body: UpdateInventoryInput,
  ) {
    await this.loadScoped(user, (a) => this.prisma.inventorySnapshot.findUnique(a), id);
    return this.prisma.inventorySnapshot.update({
      where: { id },
      data: {
        asOfDate: body.asOfDate ? dateOnly(body.asOfDate) : undefined,
        stockValue: body.stockValue,
        note: body.note,
        enteredByUserId: user.id,
      },
    });
  }

  @RequirePermissions('inventory:write')
  @Delete('inventory/:id')
  async deleteInventory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.loadScoped(user, (a) => this.prisma.inventorySnapshot.findUnique(a), id);
    return this.prisma.inventorySnapshot.delete({ where: { id } });
  }

  // ---- Student counts ----------------------------------------------------------

  @RequirePermissions('outlet:read')
  @Get('student-count')
  listStudentCounts(@CurrentUser() user: AuthUser, @Query('outletId') outletId?: string) {
    return this.prisma.studentCount.findMany({
      where: this.listWhere(user, outletId),
      include: OUTLET_INCLUDE,
      orderBy: [{ periodMonth: 'desc' }, { createdAt: 'desc' }],
    });
  }

  @RequirePermissions('studentCount:write')
  @Post('student-count')
  studentCount(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(studentCountSchema))
    body: { outletId: string; periodMonth: string; ortaokul: number; lise: number },
  ) {
    return this.prisma.studentCount.upsert({
      where: { outletId_periodMonth: { outletId: body.outletId, periodMonth: body.periodMonth } },
      create: { ...body, enteredByUserId: user.id },
      update: { ortaokul: body.ortaokul, lise: body.lise, enteredByUserId: user.id },
    });
  }

  @RequirePermissions('studentCount:write')
  @Patch('student-count/:id')
  async updateStudentCount(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updateStudentCountSchema)) body: UpdateStudentCountInput,
  ) {
    await this.loadScoped(user, (a) => this.prisma.studentCount.findUnique(a), id);
    try {
      return await this.prisma.studentCount.update({
        where: { id },
        data: { ...body, enteredByUserId: user.id },
      });
    } catch (e) {
      this.conflict409(e);
    }
  }

  @RequirePermissions('studentCount:write')
  @Delete('student-count/:id')
  async deleteStudentCount(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.loadScoped(user, (a) => this.prisma.studentCount.findUnique(a), id);
    return this.prisma.studentCount.delete({ where: { id } });
  }

  // ---- Headcount corrections -----------------------------------------------------

  @RequirePermissions('outlet:read')
  @Get('headcount')
  listHeadcounts(@CurrentUser() user: AuthUser, @Query('outletId') outletId?: string) {
    return this.prisma.headcountCorrection.findMany({
      where: this.listWhere(user, outletId),
      include: OUTLET_INCLUDE,
      orderBy: [{ periodMonth: 'desc' }, { createdAt: 'desc' }],
    });
  }

  @RequirePermissions('headcount:write')
  @Post('headcount')
  headcount(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(headcountSchema))
    body: { outletId: string; periodMonth: string; employeeCount: number; reason?: string },
  ) {
    return this.prisma.headcountCorrection.upsert({
      where: { outletId_periodMonth: { outletId: body.outletId, periodMonth: body.periodMonth } },
      create: { ...body, enteredByUserId: user.id },
      update: { employeeCount: body.employeeCount, reason: body.reason, enteredByUserId: user.id },
    });
  }

  @RequirePermissions('headcount:write')
  @Patch('headcount/:id')
  async updateHeadcount(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updateHeadcountSchema)) body: UpdateHeadcountInput,
  ) {
    await this.loadScoped(user, (a) => this.prisma.headcountCorrection.findUnique(a), id);
    try {
      return await this.prisma.headcountCorrection.update({
        where: { id },
        data: { ...body, enteredByUserId: user.id },
      });
    } catch (e) {
      this.conflict409(e);
    }
  }

  @RequirePermissions('headcount:write')
  @Delete('headcount/:id')
  async deleteHeadcount(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.loadScoped(user, (a) => this.prisma.headcountCorrection.findUnique(a), id);
    return this.prisma.headcountCorrection.delete({ where: { id } });
  }
}
