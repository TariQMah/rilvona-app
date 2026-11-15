import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { AppConfig, APP_CONFIG } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { LogPushProvider, PushProvider } from './push.provider';

const QUEUE_NAME = 'hiihive-notifications';

@Injectable()
export class NotificationsService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private connection: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly push: LogPushProvider,
  ) {}

  async onModuleInit() {
    if (!this.config.redisUrl || !this.config.enableQueue || this.config.nodeEnv === 'test') return;
    this.connection = new Redis(this.config.redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
    this.worker = new Worker(QUEUE_NAME, async (job) => this.deliver(job.data.id as string), {
      connection: this.connection.duplicate(),
    });
  }

  async notify(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Prisma.InputJsonObject;
    preference?: 'replies' | 'community' | 'events' | 'moderation' | 'security' | 'lms';
  }) {
    const prefs = await this.prisma.notificationPreference.findUnique({ where: { userId: input.userId } });
    if (prefs && input.preference && input.preference !== 'security' && prefs[input.preference] === false) {
      return null;
    }
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data,
      },
    });
    if (this.queue) {
      await this.queue.add('deliver', { id: notification.id });
    } else if (!prefs || prefs.pushEnabled) {
      await this.deliver(notification.id);
    }
    return notification;
  }

  async deliver(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      include: { user: { include: { notificationPrefs: true, deviceTokens: true } } },
    });
    if (!notification) return;
    const prefs = notification.user.notificationPrefs;
    if (prefs && !prefs.pushEnabled) return;
    const provider: PushProvider = this.push;
    for (const device of notification.user.deviceTokens.filter((item) => !item.disabledAt)) {
      await provider.send({
        token: device.token,
        platform: device.platform,
        title: notification.title,
        body: notification.body,
        data:
          notification.data && typeof notification.data === 'object' && !Array.isArray(notification.data)
            ? (notification.data as Record<string, unknown>)
            : undefined,
      });
    }
  }

  async list(userId: string, cursor: { date: Date; id: string } | undefined, limit: number) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(cursor
          ? {
              OR: [{ createdAt: { lt: cursor.date } }, { createdAt: cursor.date, id: { lt: cursor.id } }],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
  }

  async markRead(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async registerDevice(userId: string, token: string, platform: 'IOS' | 'ANDROID') {
    return this.prisma.deviceToken.upsert({
      where: { token },
      update: { userId, platform, disabledAt: null },
      create: { userId, token, platform },
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }
}
