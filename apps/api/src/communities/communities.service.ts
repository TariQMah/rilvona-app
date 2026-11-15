import { Injectable } from '@nestjs/common';
import { CreateCommunityInput, communityListQuerySchema } from '@hiihive/contracts';
import { z } from 'zod';
import { AuthUser } from '../common/auth-user';
import { cursorFilter, decodeCursor, pageResult } from '../common/cursor';
import { AppError, conflict, forbidden, notFound } from '../common/errors';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(viewer: AuthUser | null, query: z.infer<typeof communityListQuerySchema>) {
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const memberIds = viewer
      ? (
          await this.prisma.communityMembership.findMany({
            where: { userId: viewer.id, status: 'ACTIVE' },
            select: { communityId: true },
          })
        ).map((row) => row.communityId)
      : [];
    const rows = await this.prisma.community.findMany({
      where: {
        deletedAt: null,
        ...(query.category ? { category: query.category } : {}),
        ...(query.collegeId ? { collegeId: query.collegeId } : {}),
        ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
        AND: [
          cursorFilter(cursor, 'createdAt', 'desc'),
          {
            OR: [{ visibility: 'PUBLIC' }, ...(memberIds.length ? [{ id: { in: memberIds } }] : [])],
          },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: { _count: { select: { memberships: { where: { status: 'ACTIVE' } } } } },
    });
    const page = pageResult(rows, query.limit, (row) => row.createdAt);
    return {
      data: page.data.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        category: row.category,
        visibility: row.visibility,
        collegeId: row.collegeId,
        memberCount: row._count.memberships,
      })),
      meta: page.meta,
    };
  }

  async get(viewer: AuthUser | null, slug: string) {
    const community = await this.prisma.community.findUnique({
      where: { slug },
      include: {
        college: { select: { id: true, name: true, slug: true } },
        _count: { select: { memberships: { where: { status: 'ACTIVE' } } } },
      },
    });
    if (!community || community.deletedAt) throw notFound('Community not found');
    const membership = viewer
      ? await this.prisma.communityMembership.findUnique({
          where: { communityId_userId: { communityId: community.id, userId: viewer.id } },
        })
      : null;
    const isMember = membership?.status === 'ACTIVE';
    if (community.visibility === 'RESTRICTED' && !isMember && viewer?.role !== 'PLATFORM_ADMIN') {
      throw notFound('Community not found');
    }
    const moderators = await this.prisma.communityMembership.findMany({
      where: { communityId: community.id, role: 'MODERATOR', status: 'ACTIVE' },
      include: { user: { include: { profile: true } } },
      take: 20,
    });
    return {
      id: community.id,
      name: community.name,
      slug: community.slug,
      description: community.description,
      rules: community.rules,
      category: community.category,
      visibility: community.visibility,
      college: community.college,
      memberCount: community._count.memberships,
      membership: membership ? { status: membership.status, role: membership.role } : null,
      moderators: moderators.map((row) => ({
        displayName: row.user.profile?.displayName ?? 'Student',
        username: row.user.profile?.username ?? '',
      })),
    };
  }

  async create(actor: AuthUser, input: CreateCommunityInput) {
    if (actor.role !== 'PLATFORM_ADMIN' && actor.role !== 'COLLEGE_ADMIN') throw forbidden();
    const collegeId = actor.role === 'COLLEGE_ADMIN' ? actor.collegeId : (input.collegeId ?? null);
    if (actor.role === 'COLLEGE_ADMIN' && input.collegeId && input.collegeId !== actor.collegeId) throw forbidden();
    try {
      const community = await this.prisma.community.create({
        data: {
          ...input,
          collegeId,
          createdById: actor.id,
          memberships: { create: { userId: actor.id, role: 'MODERATOR', status: 'ACTIVE' } },
        },
      });
      return community;
    } catch {
      throw conflict('SLUG_IN_USE', 'That community address is taken');
    }
  }

  async join(user: AuthUser, slug: string) {
    const community = await this.requireCommunity(slug);
    const existing = await this.prisma.communityMembership.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: user.id } },
    });
    if (existing?.status === 'BANNED') throw new AppError(403, 'BANNED', 'You cannot join this community');
    const status = community.visibility === 'RESTRICTED' ? 'PENDING' : 'ACTIVE';
    if (existing?.status === 'ACTIVE' || existing?.status === 'PENDING') {
      return { status: existing.status };
    }
    const membership = existing
      ? await this.prisma.communityMembership.update({ where: { id: existing.id }, data: { status, role: 'MEMBER' } })
      : await this.prisma.communityMembership.create({
          data: { communityId: community.id, userId: user.id, status },
        });
    return { status: membership.status };
  }

  async leave(userId: string, slug: string) {
    const community = await this.requireCommunity(slug);
    await this.prisma.communityMembership.updateMany({
      where: { communityId: community.id, userId, status: { in: ['ACTIVE', 'PENDING'] } },
      data: { status: 'LEFT' },
    });
    return { status: 'LEFT' };
  }

  async pending(actor: AuthUser, slug: string) {
    const community = await this.requireModerator(actor, slug);
    const rows = await this.prisma.communityMembership.findMany({
      where: { communityId: community.id, status: 'PENDING' },
      include: { user: { include: { profile: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      userId: row.userId,
      username: row.user.profile?.username ?? '',
      displayName: row.user.profile?.displayName ?? 'Student',
      requestedAt: row.createdAt,
    }));
  }

  async decide(actor: AuthUser, slug: string, userId: string, decision: 'APPROVE' | 'REJECT') {
    const community = await this.requireModerator(actor, slug);
    const membership = await this.prisma.communityMembership.findUnique({
      where: { communityId_userId: { communityId: community.id, userId } },
    });
    if (!membership || membership.status !== 'PENDING') throw notFound('Join request not found');
    const status = decision === 'APPROVE' ? 'ACTIVE' : 'LEFT';
    await this.prisma.communityMembership.update({ where: { id: membership.id }, data: { status } });
    await this.notifications.notify({
      userId,
      type: 'COMMUNITY',
      title: decision === 'APPROVE' ? 'You joined a community' : 'Join request declined',
      body: community.name,
      preference: 'community',
      data: { communityId: community.id },
    });
    return { status };
  }

  private async requireCommunity(slug: string) {
    const community = await this.prisma.community.findUnique({ where: { slug } });
    if (!community || community.deletedAt) throw notFound('Community not found');
    return community;
  }

  private async requireModerator(actor: AuthUser, slug: string) {
    const community = await this.requireCommunity(slug);
    if (actor.role === 'PLATFORM_ADMIN') return community;
    const membership = await this.prisma.communityMembership.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: actor.id } },
    });
    if (membership?.status === 'ACTIVE' && membership.role === 'MODERATOR') return community;
    if (actor.role === 'COLLEGE_ADMIN' && actor.collegeId && actor.collegeId === community.collegeId) return community;
    throw forbidden();
  }
}
