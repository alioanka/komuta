import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  Body,
  HttpCode,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/public.decorator.js';
import { WhatsAppService } from './whatsapp.service.js';
import { IngestionService } from './ingestion.service.js';

/**
 * Meta WhatsApp Cloud API webhook.
 *  - GET  /webhooks/whatsapp → subscription verification (hub.challenge echo).
 *  - POST /webhooks/whatsapp → verify HMAC, respond 200 immediately, then process.
 * Processing is idempotent (dedupe by waMessageId) so retries are safe.
 */
@Controller('webhooks/whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly ingestion: IngestionService,
  ) {}

  @Public()
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): void {
    const ok = this.whatsapp.verifyChallenge(mode, token, challenge);
    if (ok) {
      res.status(200).send(ok);
    } else {
      res.status(403).send('Forbidden');
    }
  }

  @Public()
  @Post()
  @HttpCode(200)
  receive(@Req() req: Request, @Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const raw = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(body));
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    if (!this.whatsapp.verifySignature(raw, signature)) {
      res.status(401);
      return { ok: false, error: 'invalid signature' };
    }

    const messages = this.whatsapp.parseInbound(body);
    // Respond 200 immediately; process in the background (idempotent).
    for (const msg of messages) {
      void this.ingestion
        .handleInbound(msg)
        .catch((err) => this.logger.error(`Ingestion failed for ${msg.waMessageId}`, err));
    }
    return { ok: true, received: messages.length };
  }
}
