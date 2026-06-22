import { Module, forwardRef } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { TelegramService } from './telegram.service.js';
import { WhatsAppModule } from '../whatsapp/whatsapp.module.js';

@Module({
  imports: [forwardRef(() => WhatsAppModule)],
  providers: [NotificationsService, TelegramService],
  controllers: [NotificationsController],
  exports: [NotificationsService, TelegramService],
})
export class NotificationsModule {}
