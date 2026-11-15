import { Redis } from 'ioredis';
import { MemoryRateLimiter, RedisRateLimiter } from './rate-limiter';

describe('MemoryRateLimiter', () => {
  it('blocks the request that exceeds the window', () => {
    const limiter = new MemoryRateLimiter();
    const now = 1_000_000;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(limiter.hit('otp:user', 5, 600_000, now).allowed).toBe(true);
    }
    expect(limiter.hit('otp:user', 5, 600_000, now).allowed).toBe(false);
    expect(limiter.hit('otp:user', 5, 600_000, now + 600_000).allowed).toBe(true);
  });
});

describe('RedisRateLimiter', () => {
  it('enforces a window in Redis', async () => {
    const redis = new Redis('redis://127.0.0.1:6379', { maxRetriesPerRequest: 1 });
    const limiter = new RedisRateLimiter(redis);
    const key = `hiihive:test:${Date.now()}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await limiter.hit(key, 3, 10_000)).allowed).toBe(true);
    }
    expect((await limiter.hit(key, 3, 10_000)).allowed).toBe(false);
    await redis.del(key);
    await redis.quit();
  });
});
