import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @RequirePermissions('dashboard:read')
  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.dashboard.overview(user);
  }

  @RequirePermissions('dashboard:read')
  @Get('outlet/:id')
  async outlet(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const detail = await this.dashboard.outletDetail(user, id);
    if (!detail) throw new NotFoundException();
    return detail;
  }
}
