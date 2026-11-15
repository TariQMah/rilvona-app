import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  appPlatformSchema,
  appVersionQuerySchema,
  appVersionUpdateSchema,
  AppVersionUpdateInput,
} from '@hiihive/contracts';
import { Public, Roles } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { AppVersionService } from './appversion.service';

@ApiTags('app')
@Controller('app')
export class AppVersionController {
  constructor(private readonly versions: AppVersionService) {}

  /** The apps call this on launch to find out whether they must update. No sign in needed. */
  @Public()
  @Get('version')
  check(@Query(new ZodPipe(appVersionQuerySchema)) query: { platform: 'ANDROID' | 'IOS'; versionCode: number }) {
    return this.versions.check(query.platform, query.versionCode);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('PLATFORM_ADMIN')
@Controller('admin/app-version')
export class AppVersionAdminController {
  constructor(private readonly versions: AppVersionService) {}

  @Get()
  list() {
    return this.versions.list();
  }

  @Put(':platform')
  update(
    @Param('platform', new ZodPipe(appPlatformSchema)) platform: 'ANDROID' | 'IOS',
    @Body(new ZodPipe(appVersionUpdateSchema)) body: AppVersionUpdateInput,
  ) {
    return this.versions.update(platform, body);
  }
}
