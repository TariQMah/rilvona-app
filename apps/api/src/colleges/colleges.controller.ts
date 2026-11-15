import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { verificationRequestSchema, verificationReviewSchema, VerificationRequestInput } from '@hiihive/contracts';
import { z } from 'zod';
import { Public, Verified } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { ZodPipe } from '../common/zod.pipe';
import { CollegesService, VerificationService } from './colleges.service';

@ApiTags('colleges')
@Controller('colleges')
export class CollegesController {
  constructor(private readonly colleges: CollegesService) {}

  @Public()
  @Get()
  list() {
    return this.colleges.list();
  }

  @Public()
  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.colleges.getBySlug(slug);
  }
}

@ApiTags('verification')
@ApiBearerAuth()
@Controller('verification')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Verified()
  @Post()
  request(@CurrentUser() user: AuthUser, @Body(new ZodPipe(verificationRequestSchema)) body: VerificationRequestInput) {
    return this.verification.request(user, body);
  }

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.verification.mine(user.id);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/verifications')
export class VerificationAdminController {
  constructor(private readonly verification: VerificationService) {}

  @Get()
  queue(@CurrentUser() user: AuthUser) {
    return this.verification.queue(user);
  }

  @Post(':id/review')
  review(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(verificationReviewSchema)) body: z.infer<typeof verificationReviewSchema>,
  ) {
    return this.verification.review(user, id, body);
  }
}
