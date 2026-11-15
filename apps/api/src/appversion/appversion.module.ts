import { Module } from '@nestjs/common';
import { AppVersionAdminController, AppVersionController } from './appversion.controller';
import { AppVersionService } from './appversion.service';

@Module({
  controllers: [AppVersionController, AppVersionAdminController],
  providers: [AppVersionService],
})
export class AppVersionModule {}
