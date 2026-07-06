import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import { approveMappingSchema } from '@komuta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod-validation.pipe.js';
import { canAccessOutlet } from '../common/scope.js';

@Controller('mappings')
export class MappingsController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermissions('mapping:read')
  @Get()
  list(@Query('status') status?: string) {
    return this.prisma.phoneMapping.findMany({
      where: status ? { status: status as 'ACTIVE' | 'PENDING' | 'BLOCKED' } : {},
      include: { outlet: true, employee: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Approve a pending sender→store pairing: activate the mapping and confirm the
   * held revenue entries — but ONLY those that originated from this mapping's
   * phone (joined via WhatsAppMessage.fromPhone), never entries held for the
   * same outlet from other unknown senders.
   */
  @RequirePermissions('mapping:approve')
  @Post('approve')
  async approve(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(approveMappingSchema)) body: { mappingId: string; outletId: string },
  ) {
    const existing = await this.prisma.phoneMapping.findUnique({ where: { id: body.mappingId } });
    if (!existing) throw new NotFoundException('Mapping not found');

    const outlet = await this.prisma.outlet.findUnique({ where: { id: body.outletId } });
    if (!outlet) throw new NotFoundException('Outlet not found');
    if (!canAccessOutlet(user, outlet)) {
      throw new ForbiddenException('Outlet outside your scope');
    }

    const mapping = await this.prisma.phoneMapping.update({
      where: { id: body.mappingId },
      data: { outletId: body.outletId, status: 'ACTIVE' },
    });

    // Inbound messages sent by this phone → the only entries we may confirm.
    const senderMessages = await this.prisma.whatsAppMessage.findMany({
      where: { fromPhone: mapping.phoneE164, direction: 'IN' },
      select: { waMessageId: true },
    });
    const senderMessageIds = senderMessages.map((m) => m.waMessageId);
    if (senderMessageIds.length === 0) return mapping;

    const pending = await this.prisma.revenueEntry.findMany({
      where: {
        outletId: body.outletId,
        status: 'PENDING_REVIEW',
        source: 'WHATSAPP',
        rawMessageId: { in: senderMessageIds },
      },
      orderBy: { createdAt: 'asc' }, // oldest first → the latest correction wins.
    });
    for (const entry of pending) {
      await this.prisma.revenueEntry.updateMany({
        where: { outletId: entry.outletId, businessDate: entry.businessDate, status: 'CONFIRMED' },
        data: { status: 'SUPERSEDED' },
      });
      await this.prisma.revenueEntry.update({
        where: { id: entry.id },
        data: { status: 'CONFIRMED' },
      });
    }
    return mapping;
  }

  @RequirePermissions('mapping:approve')
  @Post('reject')
  async reject(@Body() body: { mappingId: string }) {
    const existing = await this.prisma.phoneMapping.findUnique({
      where: { id: body.mappingId ?? '' },
    });
    if (!existing) throw new NotFoundException('Mapping not found');
    return this.prisma.phoneMapping.update({
      where: { id: existing.id },
      data: { status: 'BLOCKED' },
    });
  }
}
