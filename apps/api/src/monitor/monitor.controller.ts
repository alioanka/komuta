import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { MonitorService } from './monitor.service.js';
import { DEFAULT_TIMEZONE } from '@komuta/config';
import { businessDateInTz } from '../common/date.util.js';

@Controller('monitor')
export class MonitorController {
  constructor(private readonly monitor: MonitorService) {}

  @RequirePermissions('monitor:read')
  @Get()
  matrix(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    return this.monitor.matrix(user, days ? Math.min(31, Math.max(1, Number(days))) : 7);
  }

  @RequirePermissions('monitor:read')
  @Get('missing')
  missing(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }
    const d = date ?? businessDateInTz(new Date(), DEFAULT_TIMEZONE);
    return this.monitor.missingForDate(user, d);
  }
}
