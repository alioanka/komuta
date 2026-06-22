import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { runMissingRevenueScan } from './jobs/missing-revenue.js';

/**
 * Komuta worker — BullMQ-based background processor.
 *  - Repeatable "missing-revenue-scan" at the daily reporting cutoff.
 *  - Processes ad-hoc "notification" jobs enqueued by the API.
 * Connects to Redis (REDIS_URL) and Postgres (DATABASE_URL).
 */

const QUEUE = 'komuta';
const prisma = new PrismaClient();

function redisConnection(): ConnectionOptions {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: url.password } : {}),
  };
}

function cutoffCron(): string {
  const [h, m] = env.REPORTING_CUTOFF_LOCAL.split(':');
  return `${Number(m ?? 0)} ${Number(h ?? 21)} * * *`;
}

async function main(): Promise<void> {
  const connection = redisConnection();
  const queue = new Queue(QUEUE, { connection });

  // Schedule the daily missing-revenue scan (idempotent repeatable job).
  await queue.add(
    'missing-revenue-scan',
    {},
    {
      repeat: { pattern: cutoffCron(), tz: env.DEFAULT_TIMEZONE },
      jobId: 'missing-revenue-scan-daily',
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );

  const worker = new Worker(
    QUEUE,
    async (job) => {
      switch (job.name) {
        case 'missing-revenue-scan': {
          const result = await runMissingRevenueScan(prisma);
          console.log(`[worker] missing-revenue-scan → ${result.missing} missing`);
          return result;
        }
        default:
          console.warn(`[worker] unknown job ${job.name}`);
          return null;
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => console.error(`[worker] job ${job?.name} failed:`, err.message));
  worker.on('completed', (job) => console.log(`[worker] job ${job.name} completed`));

  console.log(`[worker] started — cutoff cron "${cutoffCron()}" (${env.DEFAULT_TIMEZONE})`);

  const shutdown = async (): Promise<void> => {
    await worker.close();
    await queue.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[worker] fatal', err);
  process.exit(1);
});
