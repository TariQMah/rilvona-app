import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { cursorQuerySchema, registerDeviceSchema } from '@hiihive/contracts';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth-user';
import { decodeCursor, pageResult } from '../common/cursor';
import { ZodPipe } from '../common/zod.pipe';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(cursorQuerySchema)) query: { cursor?: string; limit: number },
  ) {
    const rows = await this.notifications.list(user.id, query.cursor ? decodeCursor(query.cursor) : undefined, query.limit);
    const page = pageResult(rows, query.limit, (row) => row.createdAt);
    return {
      data: page.data.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        data: row.data,
        readAt: row.readAt,
        createdAt: row.createdAt,
      })),
      meta: page.meta,
    };
  }

  @Post(':id/read')
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }
}

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly notifications: NotificationsService) {}

  @Put()
  async register(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(registerDeviceSchema)) body: { token: string; platform: 'IOS' | 'ANDROID' },
  ) {
    const device = await this.notifications.registerDevice(user.id, body.token, body.platform);
    return { id: device.id, platform: device.platform };
  }
}
