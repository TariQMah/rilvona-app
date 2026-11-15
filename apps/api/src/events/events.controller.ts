import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { checkInSchema, createEventSchema, CreateEventInput, cursorQuerySchema } from '@hiihive/contracts';
import { z } from 'zod';
import { Public, Verified } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { ZodPipe } from '../common/zod.pipe';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Public()
  @Get()
  list(@Query(new ZodPipe(cursorQuerySchema)) query: { cursor?: string; limit: number }) {
    return this.events.list(query.cursor, query.limit);
  }

  @ApiBearerAuth()
  @Verified()
  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createEventSchema)) body: CreateEventInput) {
    return this.events.create(user, body);
  }

  @Public()
  @Get(':id')
  get(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.events.get(id, user ?? null);
  }

  @ApiBearerAuth()
  @Verified()
  @Post(':id/register')
  register(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.events.register(user, id);
  }

  @ApiBearerAuth()
  @Delete(':id/register')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.events.cancelRegistration(user.id, id);
  }

  @ApiBearerAuth()
  @Verified()
  @Post(':id/check-in')
  checkIn(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(checkInSchema)) body: z.infer<typeof checkInSchema>,
  ) {
    return this.events.checkIn(user, id, body.userId);
  }

  @ApiBearerAuth()
  @Post(':id/cancel')
  cancelEvent(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.events.cancelEvent(user, id);
  }
}
