import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  communityListQuerySchema,
  createCommunitySchema,
  CreateCommunityInput,
  membershipDecisionSchema,
} from '@hiihive/contracts';
import { z } from 'zod';
import { Public, Verified } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { ZodPipe } from '../common/zod.pipe';
import { CommunitiesService } from './communities.service';

@ApiTags('communities')
@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communities: CommunitiesService) {}

  @Public()
  @Get()
  list(
    @CurrentUser() viewer: AuthUser | undefined,
    @Query(new ZodPipe(communityListQuerySchema)) query: z.infer<typeof communityListQuerySchema>,
  ) {
    return this.communities.list(viewer ?? null, query);
  }

  @ApiBearerAuth()
  @Verified()
  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createCommunitySchema)) body: CreateCommunityInput) {
    return this.communities.create(user, body);
  }

  @Public()
  @Get(':slug')
  get(@CurrentUser() viewer: AuthUser | undefined, @Param('slug') slug: string) {
    return this.communities.get(viewer ?? null, slug);
  }

  @ApiBearerAuth()
  @Verified()
  @Post(':slug/join')
  join(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.communities.join(user, slug);
  }

  @ApiBearerAuth()
  @Post(':slug/leave')
  leave(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.communities.leave(user.id, slug);
  }

  @ApiBearerAuth()
  @Get(':slug/requests')
  requests(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.communities.pending(user, slug);
  }

  @ApiBearerAuth()
  @Post(':slug/requests/:userId')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @Body(new ZodPipe(membershipDecisionSchema)) body: z.infer<typeof membershipDecisionSchema>,
  ) {
    return this.communities.decide(user, slug, userId, body.decision);
  }
}
