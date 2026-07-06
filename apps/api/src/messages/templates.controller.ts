import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import {
  createTemplateSchema,
  updateTemplateStatusSchema,
  type TemplateCategory,
  type TemplateStatus,
} from '@komuta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermissions } from '../common/require-permissions.decorator.js';
import { ZodPipe } from '../common/zod-validation.pipe.js';

/**
 * WhatsApp message-template registry. Templates are created/approved in Meta's
 * Business Manager; this mirror tracks which are usable so the composer can
 * offer only APPROVED templates. Guarded by `template:manage` (OWNER/ADMIN).
 */
@Controller('templates')
export class TemplatesController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermissions('template:manage')
  @Get()
  list() {
    return this.prisma.messageTemplate.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @RequirePermissions('template:manage')
  @Post()
  create(
    @Body(new ZodPipe(createTemplateSchema))
    body: { name: string; metaTemplateName: string; language: string; category: TemplateCategory },
  ) {
    return this.prisma.messageTemplate.create({ data: body });
  }

  /** Sync the Meta review outcome (APPROVED / PENDING / REJECTED). */
  @RequirePermissions('template:manage')
  @Post(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body(new ZodPipe(updateTemplateStatusSchema)) body: { status: TemplateStatus },
  ) {
    const existing = await this.prisma.messageTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Template not found');
    return this.prisma.messageTemplate.update({
      where: { id },
      data: { status: body.status },
    });
  }
}
