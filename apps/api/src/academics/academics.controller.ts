import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ImportLmsInput,
  importLmsSchema,
  SimulateLmsEventInput,
  simulateLmsEventSchema,
} from '@hiihive/contracts';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { ZodPipe } from '../common/zod.pipe';
import { AcademicsService } from './academics.service';

@ApiTags('academics')
@ApiBearerAuth()
@Controller('academics')
export class AcademicsController {
  constructor(private readonly academics: AcademicsService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.academics.overview(user.id);
  }

  /** Tables captured on-device from the student's own CUIMS session. No credentials are accepted. */
  @Post('import')
  importFromPortal(@CurrentUser() user: AuthUser, @Body(new ZodPipe(importLmsSchema)) body: ImportLmsInput) {
    return this.academics.importFromPortal(user.id, body);
  }

  @Post('demo')
  loadDemo(@CurrentUser() user: AuthUser) {
    return this.academics.loadDemo(user.id);
  }

  @Post('simulate-event')
  simulateEvent(@CurrentUser() user: AuthUser, @Body(new ZodPipe(simulateLmsEventSchema)) body: SimulateLmsEventInput) {
    return this.academics.simulateRealtimeEvent(user.id, body);
  }

  @Delete('connect')
  disconnect(@CurrentUser() user: AuthUser) {
    return this.academics.disconnect(user.id);
  }
}
