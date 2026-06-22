import { Body, Controller, Post } from '@nestjs/common';
import {
  payrollSchema,
  purchaseSchema,
  inventorySchema,
  studentCountSchema,
  headcountSchema,
} from '@komuta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod-validation.pipe.js';
import { dateOnly } from '../common/date.util.js';

/** Monthly accounting entries — upsert by (outletId, period). Salih's area. */
@Controller('accounting')
export class AccountingController {
  constructor(private readonly prisma: PrismaService) {}

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
}
