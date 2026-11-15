import { Injectable } from '@nestjs/common';
import { SearchQuery } from '@hiihive/contracts';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { AuthUser } from '../common/auth-user';
import { cursorFilter, decodeCursor, encodeCursor, pageResult } from '../common/cursor';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async search(user: AuthUser, query: SearchQuery) {
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    if (query.type === 'posts') return this.posts(user, query.q, cursor, query.limit);
    if (query.type === 'communities') return this.communities(user, query.q, cursor, query.limit);
    if (query.type === 'questions') return this.questions(user, query.q, cursor, query.limit);
    if (query.type === 'events') return this.events(query.q, cursor, query.limit);
    return this.people(user, query.q, cursor, query.limit);
  }

  private async posts(user: AuthUser, q: string, cursor: { date: Date; id: string } | undefined, limit: number) {
    const blocked = await this.access.blockedUserIds(user.id);
    const membership = await this.access.memberCommunityIds(user.id);
    const rows = await this.prisma.post.findMany({
      where: {
        deletedAt: null,
        body: { contains: q, mode: 'insensitive' },
        ...(blocked.length ? { authorId: { notIn: blocked } } : {}),
        AND: [
          cursorFilter(cursor, 'createdAt', 'desc'),
          {
            OR: [
              { communityId: null, visibility: 'PUBLIC' },
              ...(user.collegeId ? [{ communityId: null, visibility: 'COLLEGE' as const, collegeId: user.collegeId }] : []),
              { community: { visibility: 'PUBLIC' as const, deletedAt: null } },
              ...(membership.ids.length ? [{ communityId: { in: membership.ids } }] : []),
            ],
          },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: { id: true, body: true, createdAt: true },
    });
    return this.page(rows, limit, (row) => row.createdAt);
  }

  private async communities(user: AuthUser, q: string, cursor: { date: Date; id: string } | undefined, limit: number) {
    const membership = await this.access.memberCommunityIds(user.id);
    const rows = await this.prisma.community.findMany({
      where: {
        deletedAt: null,
        name: { contains: q, mode: 'insensitive' },
        AND: [
          cursorFilter(cursor, 'createdAt', 'desc'),
          { OR: [{ visibility: 'PUBLIC' }, ...(membership.ids.length ? [{ id: { in: membership.ids } }] : [])] },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: { id: true, name: true, slug: true, description: true, createdAt: true },
    });
    return this.page(rows, limit, (row) => row.createdAt);
  }

  private async questions(user: AuthUser, q: string, cursor: { date: Date; id: string } | undefined, limit: number) {
    const rows = await this.prisma.question.findMany({
      where: {
        deletedAt: null,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { body: { contains: q, mode: 'insensitive' } },
        ],
        AND: [
          cursorFilter(cursor, 'createdAt', 'desc'),
          {
            OR: [
              { communityId: null, collegeId: user.collegeId },
              { communityId: null, collegeId: null },
              { community: { visibility: 'PUBLIC', deletedAt: null } },
            ],
          },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: { id: true, title: true, pseudonym: true, createdAt: true },
    });
    return this.page(rows, limit, (row) => row.createdAt);
  }

  private async events(q: string, cursor: { date: Date; id: string } | undefined, limit: number) {
    const rows = await this.prisma.event.findMany({
      where: {
        deletedAt: null,
        status: 'PUBLISHED',
        title: { contains: q, mode: 'insensitive' },
        ...cursorFilter(cursor, 'startsAt', 'asc'),
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      select: { id: true, title: true, location: true, startsAt: true },
    });
    const page = pageResult(rows, limit, (row) => row.startsAt);
    return { data: page.data, meta: page.meta };
  }

  private async people(user: AuthUser, q: string, cursor: { date: Date; id: string } | undefined, limit: number) {
    const blocked = await this.access.blockedUserIds(user.id);
    const where: Prisma.UserProfileWhereInput = {
      user: { status: 'ACTIVE', ...(blocked.length ? { id: { notIn: blocked } } : {}) },
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
      ],
      AND: [
        {
          OR: [
            { profileVisibility: 'PUBLIC' },
            ...(user.collegeId ? [{ profileVisibility: 'COLLEGE' as const, user: { collegeId: user.collegeId } }] : []),
          ],
        },
        ...(cursor
          ? [{ OR: [{ createdAt: { lt: cursor.date } }, { createdAt: cursor.date, userId: { lt: cursor.id } }] }]
          : []),
      ],
    };
    const rows = await this.prisma.userProfile.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
      take: limit + 1,
      select: { userId: true, username: true, displayName: true, avatarUrl: true, createdAt: true },
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((row) => ({
      id: row.userId,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
    }));
    const last = rows[Math.min(rows.length, limit) - 1];
    return {
      data: items,
      meta: { hasMore, nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.userId) : null },
    };
  }

  private page<T extends { id: string }>(rows: T[], limit: number, dateOf: (row: T) => Date) {
    const page = pageResult(rows, limit, dateOf);
    return { data: page.data, meta: page.meta };
  }
}
