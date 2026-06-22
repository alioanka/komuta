import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { approveMappingSchema } from '@komuta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { ZodPipe } from '../common/zod-validation.pipe.js';

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

  /** Approve a pending sender→store pairing: activate mapping + confirm held revenue. */
  @RequirePermissions('mapping:approve')
  @Post('approve')
  async approve(@Body(new ZodPipe(approveMappingSchema)) body: { mappingId: string; outletId: string }) {
    const mapping = await this.prisma.phoneMapping.update({
      where: { id: body.mappingId },
      data: { outletId: body.outletId, status: 'ACTIVE' },
    });
    // Confirm any pending revenue entries that came from this sender for this outlet.
    const pending = await this.prisma.revenueEntry.findMany({
      where: { outletId: body.outletId, status: 'PENDING_REVIEW', source: 'WHATSAPP' },
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
  reject(@Body() body: { mappingId: string }) {
    return this.prisma.phoneMapping.update({
      where: { id: body.mappingId },
      data: { status: 'BLOCKED' },
    });
  }
}
