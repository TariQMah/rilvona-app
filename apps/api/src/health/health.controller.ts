import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Redis } from 'ioredis';
import { Public } from '../common/decorators';
import { AppError } from '../common/errors';
import { AppConfig, APP_CONFIG } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Get()
  async check() {
    let database: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    const redis = await this.redisStatus();
    const body = { status: database === 'down' ? 'down' : 'ok', database, redis };
    if (database === 'down') throw new AppError(503, 'UNHEALTHY', 'Database is unavailable', body);
    return body;
  }

  private async redisStatus() {
    if (!this.config.redisUrl) return 'skipped' as const;
    const client = new Redis(this.config.redisUrl, { connectTimeout: 1000, maxRetriesPerRequest: 1, lazyConnect: true });
    try {
      await client.connect();
      const pong = await client.ping();
      return pong === 'PONG' ? ('up' as const) : ('down' as const);
    } catch {
      return 'down' as const;
    } finally {
      client.disconnect();
    }
  }
}
