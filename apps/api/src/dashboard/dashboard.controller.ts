import { Body, Controller, Get, Param, Put, Query, NotFoundException } from '@nestjs/common';
import { dashboardConfigSchema, type DashboardConfigInput } from '@komuta/shared';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod-validation.pipe.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @RequirePermissions('dashboard:read')
  @Get('overview')
  overview(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string) {
    return this.dashboard.overview(user, companyId || undefined);
  }

  @RequirePermissions('dashboard:read')
  @Get('config')
  getConfig(@CurrentUser() user: AuthUser) {
    return this.dashboard.getConfig(user);
  }

  @RequirePermissions('dashboard:read')
  @Put('config')
  setConfig(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(dashboardConfigSchema)) body: DashboardConfigInput,
  ) {
    return this.dashboard.setConfig(user, body.config);
  }

  @RequirePermissions('dashboard:read')
  @Get('outlet/:id')
  async outlet(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const detail = await this.dashboard.outletDetail(user, id);
    if (!detail) throw new NotFoundException();
    return detail;
  }
}
