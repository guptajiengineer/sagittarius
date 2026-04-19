import { Queue, Worker, type Processor } from 'bullmq'
import IORedis from 'ioredis'
import type { ScanJob } from '@sagittarius/shared-types'

// NOTE: BullMQ requires ioredis (TCP), not Upstash REST.
// Use separate ioredis connection for BullMQ.
// Use Upstash REST (redis.ts) for caching only.

function createBullRedisConnection() {
  return new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
  })
}

export const QUEUE_NAMES = {
  SCAN_JOBS: 'scan-jobs',
} as const

export function createScanQueue() {
  return new Queue<ScanJob>(QUEUE_NAMES.SCAN_JOBS, {
    connection: createBullRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 30_000, // 30s base
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  })
}

export function createScanWorker(processor: Processor<ScanJob, void>) {
  return new Worker<ScanJob, void>(QUEUE_NAMES.SCAN_JOBS, processor, {
    connection: createBullRedisConnection(),
    concurrency: 5,
    lockDuration: 30_000,
  })
}
