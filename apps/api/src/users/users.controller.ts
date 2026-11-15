import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { notificationPrefsSchema, NotificationPrefsInput, updateProfileSchema, UpdateProfileInput } from '@hiihive/contracts';
import { AllowDeactivated, Public } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { ZodPipe } from '../common/zod.pipe';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @ApiBearerAuth()
  @AllowDeactivated()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.me(user.id);
  }

  @ApiBearerAuth()
  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body(new ZodPipe(updateProfileSchema)) body: UpdateProfileInput) {
    return this.users.updateMe(user.id, body);
  }

  @ApiBearerAuth()
  @Patch('me/notifications')
  notifications(@CurrentUser() user: AuthUser, @Body(new ZodPipe(notificationPrefsSchema)) body: NotificationPrefsInput) {
    return this.users.updateNotifications(user.id, body);
  }

  @ApiBearerAuth()
  @AllowDeactivated()
  @Get('me/export')
  exportAccount(@CurrentUser() user: AuthUser) {
    return this.users.exportAccount(user.id);
  }

  @ApiBearerAuth()
  @Post('me/deactivate')
  deactivate(@CurrentUser() user: AuthUser) {
    return this.users.deactivate(user.id);
  }

  @ApiBearerAuth()
  @AllowDeactivated()
  @Delete('me')
  remove(@CurrentUser() user: AuthUser) {
    return this.users.deleteAccount(user.id);
  }

  @ApiBearerAuth()
  @Get('me/blocks')
  blocks(@CurrentUser() user: AuthUser) {
    return this.users.blocks(user.id);
  }

  @Public()
  @Get(':username')
  profile(@CurrentUser() viewer: AuthUser | undefined, @Param('username') username: string) {
    return this.users.publicProfile(viewer ?? null, username.toLowerCase());
  }

  @ApiBearerAuth()
  @Post(':username/block')
  block(@CurrentUser() user: AuthUser, @Param('username') username: string) {
    return this.users.block(user.id, username.toLowerCase());
  }

  @ApiBearerAuth()
  @Delete(':username/block')
  unblock(@CurrentUser() user: AuthUser, @Param('username') username: string) {
    return this.users.unblock(user.id, username.toLowerCase());
  }
}
