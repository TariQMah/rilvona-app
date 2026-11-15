import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AcademicsController } from './academics.controller';
import { AcademicsService } from './academics.service';
import { ChandigarhUniversityAdapter } from './chandigarh-university.adapter';

@Module({
  imports: [NotificationsModule],
  controllers: [AcademicsController],
  providers: [AcademicsService, ChandigarhUniversityAdapter],
  exports: [AcademicsService],
})
export class AcademicsModule {}
