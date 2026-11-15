import { Module } from '@nestjs/common';
import { BookmarksController, CommunityPostsController, FeedController, PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  controllers: [FeedController, PostsController, BookmarksController, CommunityPostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
