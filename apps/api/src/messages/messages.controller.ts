import { Body, Controller, Get, Post, Query, Param } from '@nestjs/common';
import { sendMessageSchema } from '@komuta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { OutboundService } from '../whatsapp/outbound.service.js';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { ZodPipe } from '../common/zod-validation.pipe.js';

@Controller('messages')
export class MessagesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: OutboundService,
  ) {}

  @RequirePermissions('message:read')
  @Get()
  list(@Query('search') search?: string, @Query('direction') direction?: string) {
    return this.prisma.whatsAppMessage.findMany({
      where: {
        ...(direction ? { direction: direction as 'IN' | 'OUT' } : {}),
        ...(search ? { OR: [{ body: { contains: search, mode: 'insensitive' } }, { fromPhone: { contains: search } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Conversation thread with one phone number. */
  @RequirePermissions('message:read')
  @Get('thread/:phone')
  thread(@Param('phone') phone: string) {
    return this.prisma.whatsAppMessage.findMany({
      where: { OR: [{ fromPhone: phone }, { toPhone: phone }] },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  /** Window-eligibility hint for the composer. */
  @RequirePermissions('message:read')
  @Get('window/:phone')
  async window(@Param('phone') phone: string) {
    return { open: await this.outbound.isWindowOpen(phone) };
  }

  @RequirePermissions('message:send')
  @Post('send')
  send(
    @Body(new ZodPipe(sendMessageSchema))
    body: { toPhone: string; body?: string; templateName?: string; templateVars?: string[] },
  ) {
    return this.outbound.sendMessage(body.toPhone, {
      body: body.body,
      templateName: body.templateName,
      templateVars: body.templateVars,
    });
  }
}
