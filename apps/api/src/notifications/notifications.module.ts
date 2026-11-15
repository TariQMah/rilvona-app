import { Global, Module } from '@nestjs/common';
import { DevicesController, NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { LogPushProvider } from './push.provider';

@Global()
@Module({
  controllers: [NotificationsController, DevicesController],
  providers: [NotificationsService, LogPushProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
