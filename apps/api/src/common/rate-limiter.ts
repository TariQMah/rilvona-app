import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfig, APP_CONFIG } from '../config/env';
import { Inject } from '@nestjs/common';
import { AppError } from './errors';

export class MemoryRateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  hit(key: string, limit: number, windowMs: number, now = Date.now()) {
    const current = this.hits.get(key);
    if (!current || current.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1 };
    }
    current.count += 1;
    return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count) };
  }
}

export class RedisRateLimiter {
  constructor(private readonly redis: Redis) {}

  async hit(key: string, limit: number, windowMs: number) {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.pexpire(key, windowMs);
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  }
}

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly memory = new MemoryRateLimiter();
  private readonly redis: Redis | null;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.redis = config.redisUrl
      ? new Redis(config.redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 1000, lazyConnect: true })
      : null;
  }

  async consume(key: string, limit: number, windowMs: number, message: string) {
    const result = this.redis ? await this.hitRedis(key, limit, windowMs) : this.memory.hit(key, limit, windowMs);
    if (!result.allowed) throw new AppError(429, 'RATE_LIMITED', message);
  }

  private async hitRedis(key: string, limit: number, windowMs: number) {
    if (!this.redis) return this.memory.hit(key, limit, windowMs);
    if (this.redis.status === 'wait') await this.redis.connect();
    const limiter = new RedisRateLimiter(this.redis);
    return limiter.hit(key, limit, windowMs);
  }

  async onModuleDestroy() {
    if (this.redis) await this.redis.quit();
  }
}
