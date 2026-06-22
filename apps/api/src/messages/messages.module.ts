import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller.js';
import { WhatsAppModule } from '../whatsapp/whatsapp.module.js';

@Module({
  imports: [WhatsAppModule],
  controllers: [MessagesController],
})
export class MessagesModule {}
