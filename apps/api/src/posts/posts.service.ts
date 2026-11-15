import { Inject, Injectable } from '@nestjs/common';
import { CreateCommentInput, CreatePostInput } from '@hiihive/contracts';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { canDeleteContent } from '../access/policy';
import { AuthUser } from '../common/auth-user';
import { cursorFilter, decodeCursor, pageResult } from '../common/cursor';
import { AppError, forbidden, notFound } from '../common/errors';
import { AppConfig, APP_CONFIG } from '../config/env';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const postInclude = {
  author: { include: { profile: true } },
  community: { select: { id: true, name: true, slug: true, visibility: true } },
  college: { select: { id: true, name: true, slug: true } },
  media: { orderBy: { sortOrder: 'asc' as const } },
  _count: { select: { reactions: true, comments: { where: { deletedAt: null } } } },
} satisfies Prisma.PostInclude;

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async feed(viewer: AuthUser | null, cursor: string | undefined, limit: number, scope: 'home' | 'public') {
    const decoded = cursor ? decodeCursor(cursor) : undefined;
    const blocked = viewer ? await this.access.blockedUserIds(viewer.id) : [];
    const membership = viewer ? await this.access.memberCommunityIds(viewer.id) : { ids: [], moderatorIds: [] };
    const publicClause: Prisma.PostWhereInput[] = [
      { communityId: null, visibility: 'PUBLIC' },
      { community: { visibility: 'PUBLIC', deletedAt: null } },
    ];
    const homeClause: Prisma.PostWhereInput[] = [
      ...publicClause,
      ...(viewer?.collegeId ? [{ communityId: null, visibility: 'COLLEGE' as const, collegeId: viewer.collegeId }] : []),
      ...(membership.ids.length ? [{ communityId: { in: membership.ids } }] : []),
      ...(viewer ? [{ authorId: viewer.id }] : []),
    ];
    const rows = await this.prisma.post.findMany({
      where: {
        deletedAt: null,
        ...(blocked.length ? { authorId: { notIn: blocked } } : {}),
        AND: [cursorFilter(decoded, 'createdAt', 'desc'), { OR: scope === 'public' ? publicClause : homeClause }],
      },
      include: postInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return this.presentPage(rows, limit, viewer?.id);
  }

  async communityFeed(viewer: AuthUser, slug: string, cursor: string | undefined, limit: number) {
    const community = await this.prisma.community.findUnique({ where: { slug } });
    if (!community || community.deletedAt) throw notFound('Community not found');
    const membership = await this.prisma.communityMembership.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: viewer.id } },
    });
    if (community.visibility === 'RESTRICTED' && membership?.status !== 'ACTIVE' && viewer.role !== 'PLATFORM_ADMIN') {
      throw notFound('Community not found');
    }
    const decoded = cursor ? decodeCursor(cursor) : undefined;
    const blocked = await this.access.blockedUserIds(viewer.id);
    const rows = await this.prisma.post.findMany({
      where: {
        communityId: community.id,
        deletedAt: null,
        ...(blocked.length ? { authorId: { notIn: blocked } } : {}),
        ...cursorFilter(decoded, 'createdAt', 'desc'),
      },
      include: postInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return this.presentPage(rows, limit, viewer.id);
  }

  async create(user: AuthUser, input: CreatePostInput) {
    let visibility = input.visibility;
    let collegeId: string | null = user.collegeId;
    if (input.communityId) {
      const membership = await this.prisma.communityMembership.findUnique({
        where: { communityId_userId: { communityId: input.communityId, userId: user.id } },
        include: { community: true },
      });
      if (!membership || membership.status !== 'ACTIVE' || membership.community.deletedAt) {
        throw forbidden('Join this community before posting');
      }
      visibility = 'COMMUNITY';
      collegeId = membership.community.collegeId;
    } else if (visibility === 'COLLEGE') {
      const verified = await this.access.assertVerifiedCollege(user.id, user.collegeId);
      if (!verified) throw new AppError(403, 'COLLEGE_UNVERIFIED', 'Verify your college before posting to the college feed');
    }
    const media = input.mediaIds?.length
      ? await this.prisma.mediaUpload.findMany({
          where: { id: { in: input.mediaIds }, userId: user.id, status: 'READY', postMedia: null },
        })
      : [];
    if (input.mediaIds && media.length !== input.mediaIds.length) {
      throw new AppError(400, 'INVALID_MEDIA', 'One or more images are not ready to attach');
    }
    const post = await this.prisma.post.create({
      data: {
        authorId: user.id,
        collegeId,
        communityId: input.communityId,
        body: input.body,
        visibility,
        media: {
          create: media.map((item, index) => ({
            uploadId: item.id,
            storageKey: item.storageKey,
            mimeType: item.mimeType,
            sortOrder: index,
          })),
        },
      },
      include: postInclude,
    });
    return this.present(post, false, false);
  }

  async get(user: AuthUser, id: string) {
    await this.access.visiblePost(user, id);
    const post = await this.prisma.post.findUnique({ where: { id }, include: postInclude });
    if (!post) throw notFound('Post not found');
    const [liked, bookmarked] = await Promise.all([
      this.prisma.reaction.findUnique({ where: { userId_postId: { userId: user.id, postId: id } } }),
      this.prisma.bookmark.findUnique({ where: { userId_postId: { userId: user.id, postId: id } } }),
    ]);
    return this.present(post, Boolean(liked), Boolean(bookmarked));
  }

  async remove(user: AuthUser, id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post || post.deletedAt) throw notFound('Post not found');
    const mods = await this.access.memberCommunityIds(user.id);
    if (!canDeleteContent(user, post, mods.moderatorIds)) throw forbidden();
    await this.prisma.post.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }

  async comments(user: AuthUser, postId: string, cursor: string | undefined, limit: number) {
    await this.access.visiblePost(user, postId);
    const decoded = cursor ? decodeCursor(cursor) : undefined;
    const rows = await this.prisma.comment.findMany({
      where: { postId, deletedAt: null, ...cursorFilter(decoded, 'createdAt', 'asc') },
      include: { author: { include: { profile: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const page = pageResult(rows, limit, (row) => row.createdAt);
    return {
      data: page.data.map((row) => this.presentComment(row)),
      meta: page.meta,
    };
  }

  async comment(user: AuthUser, postId: string, input: CreateCommentInput) {
    const post = await this.access.visiblePost(user, postId);
    if (input.parentId) {
      const parent = await this.prisma.comment.findFirst({ where: { id: input.parentId, postId, deletedAt: null } });
      if (!parent) throw notFound('Comment not found');
    }
    const comment = await this.prisma.comment.create({
      data: { postId, authorId: user.id, body: input.body, parentId: input.parentId },
      include: { author: { include: { profile: true } } },
    });
    if (post.authorId !== user.id) {
      await this.notifications.notify({
        userId: post.authorId,
        type: 'REPLY',
        title: 'New reply',
        body: 'Someone replied to your post',
        preference: 'replies',
        data: { postId },
      });
    }
    const mentions = new Set(input.body.match(/@([a-z0-9_]{3,20})/g)?.map((item) => item.slice(1)) ?? []);
    if (mentions.size) {
      const people = await this.prisma.userProfile.findMany({ where: { username: { in: [...mentions] } } });
      for (const person of people) {
        if (person.userId === user.id) continue;
        await this.notifications.notify({
          userId: person.userId,
          type: 'MENTION',
          title: 'You were mentioned',
          body: 'Someone mentioned you in a comment',
          preference: 'replies',
          data: { postId },
        });
      }
    }
    return this.presentComment(comment);
  }

  async like(userId: string, postId: string, user: AuthUser) {
    await this.access.visiblePost(user, postId);
    await this.prisma.reaction.upsert({
      where: { userId_postId: { userId, postId } },
      update: {},
      create: { userId, postId, type: 'LIKE' },
    });
    return { liked: true };
  }

  async unlike(userId: string, postId: string) {
    await this.prisma.reaction.deleteMany({ where: { userId, postId } });
    return { liked: false };
  }

  async bookmark(user: AuthUser, postId: string) {
    await this.access.visiblePost(user, postId);
    await this.prisma.bookmark.upsert({
      where: { userId_postId: { userId: user.id, postId } },
      update: {},
      create: { userId: user.id, postId },
    });
    return { bookmarked: true };
  }

  async unbookmark(userId: string, postId: string) {
    await this.prisma.bookmark.deleteMany({ where: { userId, postId } });
    return { bookmarked: false };
  }

  async bookmarks(user: AuthUser, cursor: string | undefined, limit: number) {
    const decoded = cursor ? decodeCursor(cursor) : undefined;
    const rows = await this.prisma.bookmark.findMany({
      where: {
        userId: user.id,
        post: { deletedAt: null },
        ...(decoded
          ? { OR: [{ createdAt: { lt: decoded.date } }, { createdAt: decoded.date, id: { lt: decoded.id } }] }
          : {}),
      },
      include: { post: { include: postInclude } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = pageResult(rows, limit, (row) => row.createdAt);
    return {
      data: page.data.map((row) => this.present(row.post, false, true)),
      meta: page.meta,
    };
  }

  private async presentPage(
    rows: Prisma.PostGetPayload<{ include: typeof postInclude }>[],
    limit: number,
    viewerId?: string,
  ) {
    const page = pageResult(rows, limit, (row) => row.createdAt);
    const ids = page.data.map((row) => row.id);
    const [likes, bookmarks] = viewerId
      ? await Promise.all([
          this.prisma.reaction.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } }),
          this.prisma.bookmark.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } }),
        ])
      : [[], []];
    const liked = new Set(likes.map((row) => row.postId));
    const saved = new Set(bookmarks.map((row) => row.postId));
    return {
      data: page.data.map((row) => this.present(row, liked.has(row.id), saved.has(row.id))),
      meta: page.meta,
    };
  }

  private present(
    post: Prisma.PostGetPayload<{ include: typeof postInclude }>,
    likedByMe: boolean,
    bookmarkedByMe: boolean,
  ) {
    return {
      id: post.id,
      body: post.body,
      visibility: post.visibility,
      createdAt: post.createdAt,
      author: {
        id: post.author.id,
        displayName: post.author.profile?.displayName ?? 'Student',
        username: post.author.profile?.username ?? 'student',
        avatarUrl: post.author.profile?.avatarUrl ?? null,
      },
      community: post.community ? { id: post.community.id, name: post.community.name, slug: post.community.slug } : null,
      college: post.college,
      media: post.media.map((item) => ({
        id: item.id,
        mimeType: item.mimeType,
        url: this.config.storagePublicBaseUrl ? `${this.config.storagePublicBaseUrl}/${item.storageKey}` : null,
      })),
      counts: { likes: post._count.reactions, comments: post._count.comments },
      likedByMe,
      bookmarkedByMe,
      sharePath: `${this.config.publicWebOrigin}/posts/${post.id}`,
    };
  }

  private presentComment(comment: {
    id: string;
    postId: string;
    parentId: string | null;
    body: string;
    createdAt: Date;
    author: { id: string; profile: { displayName: string; username: string; avatarUrl: string | null } | null };
  }) {
    return {
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      body: comment.body,
      createdAt: comment.createdAt,
      author: {
        id: comment.author.id,
        displayName: comment.author.profile?.displayName ?? 'Student',
        username: comment.author.profile?.username ?? 'student',
        avatarUrl: comment.author.profile?.avatarUrl ?? null,
      },
    };
  }
}
