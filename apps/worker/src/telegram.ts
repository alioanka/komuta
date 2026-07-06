import { env } from './env.js';

/** Escape user-controlled text for parse_mode=HTML (unescaped '<' rejects the send). */
export function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Lightweight Telegram sender (standalone — worker does not import the Nest app). */
export async function sendTelegram(text: string, chatId?: string): Promise<boolean> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const target = chatId || env.TELEGRAM_DEFAULT_CHAT_ID;
  if (!token || !target) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: target, text, parse_mode: 'HTML' }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
