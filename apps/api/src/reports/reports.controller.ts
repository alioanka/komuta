import { Controller, Get, Query } from '@nestjs/common';
import {
  reportsRevenueQuerySchema,
  reportsBranchesQuerySchema,
  type ReportsRevenueQuery,
  type ReportsBranchesQuery,
} from '@komuta/shared';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod-validation.pipe.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @RequirePermissions('dashboard:read')
  @Get('revenue')
  revenue(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(reportsRevenueQuerySchema)) query: ReportsRevenueQuery,
  ) {
    return this.reports.revenue(user, query);
  }

  @RequirePermissions('dashboard:read')
  @Get('branches')
  branches(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(reportsBranchesQuerySchema)) query: ReportsBranchesQuery,
  ) {
    return this.reports.branches(user, query);
  }
}
