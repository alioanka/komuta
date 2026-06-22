import { Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '../config/env.js';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  get enabled(): boolean {
    return !!loadEnv().TELEGRAM_BOT_TOKEN;
  }

  /** Send a Telegram message. Returns true on success, false if not configured/failed. */
  async sendMessage(text: string, chatId?: string): Promise<boolean> {
    const env = loadEnv();
    const token = env.TELEGRAM_BOT_TOKEN;
    const target = chatId || env.TELEGRAM_DEFAULT_CHAT_ID;
    if (!token || !target) {
      this.logger.warn('Telegram not configured — skipping send');
      return false;
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: target, text, parse_mode: 'HTML' }),
      });
      if (!res.ok) {
        this.logger.error(`Telegram send failed: ${res.status} ${await res.text()}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error('Telegram send error', err as Error);
      return false;
    }
  }
}
