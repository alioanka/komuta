import { Module, forwardRef } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller.js';
import { WhatsAppService } from './whatsapp.service.js';
import { IngestionService } from './ingestion.service.js';
import { OutboundService } from './outbound.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [forwardRef(() => NotificationsModule)],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, IngestionService, OutboundService],
  exports: [IngestionService, WhatsAppService, OutboundService],
})
export class WhatsAppModule {}
