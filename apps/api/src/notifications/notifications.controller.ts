import { Body, Controller, Get, Param, Post, Sse, MessageEvent } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { notificationRuleSchema, type NotificationChannel } from '@komuta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { AllowTokenQuery } from '../common/allow-token-query.decorator.js';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod-validation.pipe.js';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @RequirePermissions('notification:read')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user.id);
  }

  @RequirePermissions('notification:read')
  @Get('unread-count')
  async unread(@CurrentUser() user: AuthUser) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @RequirePermissions('notification:read')
  @Post(':id/read')
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }

  /**
   * Server-Sent Events stream of in-app notifications for the current user.
   * Browser EventSource cannot set headers, so this route (and only this
   * route) also accepts the access JWT via `?token=` — same verification.
   */
  @RequirePermissions('notification:read')
  @AllowTokenQuery()
  @Sse('stream')
  stream(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    return this.notifications.stream(user.id).pipe(map((data) => ({ data }) as MessageEvent));
  }

  @RequirePermissions('notification:manage')
  @Get('rules')
  rules() {
    return this.prisma.notificationRule.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @RequirePermissions('notification:manage')
  @Post('rules')
  createRule(@Body(new ZodPipe(notificationRuleSchema)) body: Record<string, unknown>) {
    return this.prisma.notificationRule.create({ data: body as never });
  }

  @RequirePermissions('notification:manage')
  @Post('test')
  test(@CurrentUser() user: AuthUser, @Body() body: { channel: NotificationChannel }) {
    return this.notifications.testChannel(body.channel, user.id);
  }
}
