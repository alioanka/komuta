import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './common/jwt-auth.guard.js';
import { PermissionsGuard } from './common/permissions.guard.js';
import { HealthController } from './health/health.controller.js';
import { WhatsAppModule } from './whatsapp/whatsapp.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { MonitorModule } from './monitor/monitor.module.js';
import { RevenueModule } from './revenue/revenue.module.js';
import { OrgModule } from './org/org.module.js';
import { AccountingModule } from './accounting/accounting.module.js';
import { UsersModule } from './users/users.module.js';
import { MappingsModule } from './mappings/mappings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    WhatsAppModule,
    DashboardModule,
    MonitorModule,
    RevenueModule,
    OrgModule,
    AccountingModule,
    UsersModule,
    MappingsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
