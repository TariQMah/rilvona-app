import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createCommentSchema, createPostSchema, CreateCommentInput, CreatePostInput, cursorQuerySchema } from '@hiihive/contracts';
import { Public, Verified } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { ZodPipe } from '../common/zod.pipe';
import { PostsService } from './posts.service';

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(private readonly posts: PostsService) {}

  @ApiBearerAuth()
  @Get()
  home(@CurrentUser() user: AuthUser, @Query(new ZodPipe(cursorQuerySchema)) query: { cursor?: string; limit: number }) {
    return this.posts.feed(user, query.cursor, query.limit, 'home');
  }

  @Public()
  @Get('public')
  publicFeed(@Query(new ZodPipe(cursorQuerySchema)) query: { cursor?: string; limit: number }) {
    return this.posts.feed(null, query.cursor, query.limit, 'public');
  }
}

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Verified()
  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createPostSchema)) body: CreatePostInput) {
    return this.posts.create(user, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.get(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.remove(user, id);
  }

  @Get(':id/comments')
  comments(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query(new ZodPipe(cursorQuerySchema)) query: { cursor?: string; limit: number },
  ) {
    return this.posts.comments(user, id, query.cursor, query.limit);
  }

  @Verified()
  @Post(':id/comments')
  comment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(createCommentSchema)) body: CreateCommentInput,
  ) {
    return this.posts.comment(user, id, body);
  }

  @Verified()
  @Put(':id/reaction')
  like(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.like(user.id, id, user);
  }

  @Delete(':id/reaction')
  unlike(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.unlike(user.id, id);
  }

  @Verified()
  @Put(':id/bookmark')
  bookmark(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.bookmark(user, id);
  }

  @Delete(':id/bookmark')
  unbookmark(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.unbookmark(user.id, id);
  }
}

@ApiTags('bookmarks')
@ApiBearerAuth()
@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(cursorQuerySchema)) query: { cursor?: string; limit: number }) {
    return this.posts.bookmarks(user, query.cursor, query.limit);
  }
}

@ApiTags('communities')
@ApiBearerAuth()
@Controller('communities')
export class CommunityPostsController {
  constructor(private readonly posts: PostsService) {}

  @Get(':slug/posts')
  list(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Query(new ZodPipe(cursorQuerySchema)) query: { cursor?: string; limit: number },
  ) {
    return this.posts.communityFeed(user, slug, query.cursor, query.limit);
  }
}
