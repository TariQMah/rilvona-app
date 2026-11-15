import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { notFound } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { canViewPost } from './policy';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async blockedUserIds(userId: string) {
    const rows = await this.prisma.blockedUser.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    return rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId));
  }

  async isBlocked(leftId: string, rightId: string) {
    const row = await this.prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: leftId, blockedId: rightId },
          { blockerId: rightId, blockedId: leftId },
        ],
      },
    });
    return Boolean(row);
  }

  async memberCommunityIds(userId: string) {
    const rows = await this.prisma.communityMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { communityId: true, role: true },
    });
    return {
      ids: rows.map((row) => row.communityId),
      moderatorIds: rows.filter((row) => row.role === 'MODERATOR').map((row) => row.communityId),
    };
  }

  async latestVerification(userId: string) {
    return this.prisma.collegeVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assertVerifiedCollege(userId: string, collegeId: string | null) {
    if (!collegeId) return false;
    const verification = await this.latestVerification(userId);
    return verification?.status === 'VERIFIED' && verification.collegeId === collegeId;
  }

  async visiblePost(viewer: AuthUser, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { community: { select: { id: true, visibility: true, deletedAt: true } } },
    });
    if (!post || post.community?.deletedAt) throw notFound('Post not found');
    const membership = post.communityId
      ? await this.prisma.communityMembership.findUnique({
          where: { communityId_userId: { communityId: post.communityId, userId: viewer.id } },
        })
      : null;
    const visible = canViewPost({
      viewer,
      blocked: await this.isBlocked(viewer.id, post.authorId),
      isMember: membership?.status === 'ACTIVE',
      post: {
        authorId: post.authorId,
        visibility: post.visibility,
        collegeId: post.collegeId,
        communityId: post.communityId,
        communityVisibility: post.community?.visibility ?? null,
        deletedAt: post.deletedAt,
      },
    });
    if (!visible) throw notFound('Post not found');
    return post;
  }
}
