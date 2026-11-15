import { Module } from '@nestjs/common';
import { CollegesController, VerificationAdminController, VerificationController } from './colleges.controller';
import { CollegesService, VerificationService } from './colleges.service';

@Module({
  controllers: [CollegesController, VerificationController, VerificationAdminController],
  providers: [CollegesService, VerificationService],
  exports: [CollegesService, VerificationService],
})
export class CollegesModule {}
