import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  // The API sits behind Nginx: trust the first proxy hop so req.ip (and thus
  // per-client rate limiting) uses the real client IP, not the proxy's.
  (app.getHttpAdapter().getInstance() as express.Express).set('trust proxy', 1);

  // Capture the raw body for WhatsApp HMAC verification.
  app.use(
    express.json({
      verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(helmet());

  app.enableCors({
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  });
  // Validation is handled per-route via zod (ZodPipe) — no class-validator needed.

  await app.listen(env.API_PORT);
  Logger.log(`Komuta API listening on :${env.API_PORT}`, 'Bootstrap');
}

void bootstrap();
