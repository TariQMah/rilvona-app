import { Injectable, Logger } from '@nestjs/common';
import { DevicePlatform } from '@prisma/client';

export type PushMessage = {
  token: string;
  platform: DevicePlatform;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export interface PushProvider {
  send(message: PushMessage): Promise<void>;
}

@Injectable()
export class LogPushProvider implements PushProvider {
  private readonly logger = new Logger(LogPushProvider.name);

  async send(message: PushMessage) {
    const fcmServerKey = process.env.FCM_SERVER_KEY;
    if (fcmServerKey && !message.token.startsWith('hiihive-local-')) {
      try {
        await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${fcmServerKey}`,
          },
          body: JSON.stringify({
            to: message.token,
            priority: 'high',
            notification: {
              title: message.title,
              body: message.body,
              sound: 'default',
            },
            data: message.data ?? {},
          }),
        });
      } catch (err) {
        this.logger.warn(`FCM push failed for ${message.platform}: ${(err as Error).message}`);
      }
    }
    this.logger.log(`push ${message.platform} [${message.title}] ${message.body}`);
  }
}
