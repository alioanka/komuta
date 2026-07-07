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
import { normalizeTr } from '@komuta/money';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from '@komuta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod-validation.pipe.js';
import { canAccessOutlet } from '../common/scope.js';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermissions('outlet:read')
  @Get()
  list(@Query('outletId') outletId?: string) {
    return this.prisma.employee.findMany({
      where: outletId ? { outletId } : {},
      include: { outlet: { select: { id: true, name: true, code: true } } },
      orderBy: { fullName: 'asc' },
    });
  }

  @RequirePermissions('employee:write')
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createEmployeeSchema)) body: CreateEmployeeInput,
  ) {
    if (body.outletId) await this.assertOutletInScope(user, body.outletId);
    return this.prisma.employee.create({
      data: {
        fullName: body.fullName,
        normalizedName: normalizeTr(body.fullName),
        outletId: body.outletId ?? null,
      },
      include: { outlet: { select: { id: true, name: true, code: true } } },
    });
  }

  @RequirePermissions('employee:write')
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updateEmployeeSchema)) body: UpdateEmployeeInput,
  ) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException('Employee not found');
    if (body.outletId) await this.assertOutletInScope(user, body.outletId);
    return this.prisma.employee.update({
      where: { id },
      data: {
        fullName: body.fullName,
        // Keep the matching key in sync with the display name.
        normalizedName: body.fullName !== undefined ? normalizeTr(body.fullName) : undefined,
        outletId: body.outletId,
        isActive: body.isActive,
      },
      include: { outlet: { select: { id: true, name: true, code: true } } },
    });
  }

  @RequirePermissions('employee:write')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { phoneMappings: { where: { status: 'ACTIVE' }, select: { id: true } } },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.phoneMappings.length > 0) {
      throw new ConflictException(
        'Employee is referenced by an ACTIVE phone mapping; reassign or delete the mapping first',
      );
    }
    return this.prisma.employee.delete({ where: { id } });
  }

  private async assertOutletInScope(user: AuthUser, outletId: string): Promise<void> {
    const outlet = await this.prisma.outlet.findUnique({ where: { id: outletId } });
    if (!outlet) throw new NotFoundException('Outlet not found');
    if (!canAccessOutlet(user, outlet)) {
      throw new ForbiddenException('Outlet outside your scope');
    }
  }
}
