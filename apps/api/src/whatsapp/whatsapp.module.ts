import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller.js';
import { WhatsAppService } from './whatsapp.service.js';
import { IngestionService } from './ingestion.service.js';

@Module({
  controllers: [WhatsAppController],
  providers: [WhatsAppService, IngestionService],
  exports: [IngestionService, WhatsAppService],
})
export class WhatsAppModule {}
