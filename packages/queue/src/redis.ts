import { Redis } from '@upstash/redis'

// Lazy singleton Redis connection using Upstash REST API
// No persistent TCP connection — safe for serverless Next.js API routes
let _redis: Redis | null = null

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.REDIS_URL!,
      token: process.env.REDIS_TOKEN!,
    })
  }
  return _redis
}

// Keep backward compat for any code using `redis` directly
export const redis = typeof process !== 'undefined' && process.env.REDIS_URL?.startsWith('https')
  ? new Redis({ url: process.env.REDIS_URL!, token: process.env.REDIS_TOKEN! })
  : (null as unknown as Redis) // Will be null when using local ioredis
