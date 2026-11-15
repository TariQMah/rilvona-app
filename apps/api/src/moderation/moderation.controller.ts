import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { moderationSchema, ModerationInput, reportSchema, ReportInput } from '@hiihive/contracts';
import { Verified } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { ZodPipe } from '../common/zod.pipe';
import { ModerationService } from './moderation.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly moderation: ModerationService) {}

  @Verified()
  @Post()
  report(@CurrentUser() user: AuthUser, @Body(new ZodPipe(reportSchema)) body: ReportInput) {
    return this.moderation.report(user, body);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('reports')
  queue(@CurrentUser() user: AuthUser) {
    return this.moderation.queue(user);
  }

  @Post('moderation')
  act(@CurrentUser() user: AuthUser, @Body(new ZodPipe(moderationSchema)) body: ModerationInput) {
    return this.moderation.act(user, body);
  }
}
