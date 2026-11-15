import { Module } from '@nestjs/common';
import { AdminModerationController, ReportsController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Module({
  controllers: [ReportsController, AdminModerationController],
  providers: [ModerationService],
})
export class ModerationModule {}
