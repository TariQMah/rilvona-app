import { Injectable } from '@nestjs/common';
import { ModerationInput, ReportInput } from '@hiihive/contracts';
import { ReportTargetType } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { canModerateContent } from '../access/policy';
import { AuthUser } from '../common/auth-user';
import { AppError, forbidden, notFound } from '../common/errors';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

type TargetRef = { authorId: string | null; collegeId: string | null; communityId: string | null };

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  async report(user: AuthUser, input: ReportInput) {
    const target = await this.lookup(input.targetType, input.targetId);
    if (target.authorId === user.id) throw new AppError(400, 'INVALID_REPORT', 'You cannot report your own content');
    return this.prisma.report.create({
      data: {
        reporterId: user.id,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        details: input.details,
      },
      select: { id: true, status: true, createdAt: true },
    });
  }

  async queue(actor: AuthUser) {
    if (actor.role !== 'PLATFORM_ADMIN' && actor.role !== 'COLLEGE_ADMIN') throw forbidden();
    return this.prisma.report.findMany({
      where: { status: { in: ['OPEN', 'REVIEWING'] } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async act(actor: AuthUser, input: ModerationInput) {
    const target = await this.lookup(input.targetType, input.targetId);
    const mods = await this.access.memberCommunityIds(actor.id);
    const communityId = input.communityId ?? target.communityId;
    if (!canModerateContent(actor, { collegeId: target.collegeId, communityId }, mods.moderatorIds)) {
      throw forbidden();
    }
    if (input.action === 'BAN_MEMBER') {
      if (!input.communityId || input.targetType !== 'USER') {
        throw new AppError(400, 'COMMUNITY_REQUIRED', 'Choose a community to ban a member from');
      }
      await this.prisma.communityMembership.updateMany({
        where: { communityId: input.communityId, userId: input.targetId },
        data: { status: 'BANNED' },
      });
    }
    if (input.action === 'REMOVE_CONTENT') await this.removeContent(input.targetType, input.targetId);
    if (input.action === 'SUSPEND_USER') {
      if (input.targetType !== 'USER') throw new AppError(400, 'INVALID_TARGET', 'Suspend applies to a student account');
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: input.targetId },
          data: { status: 'DEACTIVATED', deactivatedAt: new Date(), tokenVersion: { increment: 1 } },
        }),
        this.prisma.refreshTokenSession.updateMany({
          where: { userId: input.targetId, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);
    }
    const action = await this.prisma.moderationAction.create({
      data: {
        reportId: input.reportId,
        actorId: actor.id,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        notes: input.notes,
      },
    });
    if (input.reportId) {
      await this.prisma.report.update({
        where: { id: input.reportId },
        data: { status: input.action === 'DISMISS' ? 'DISMISSED' : 'RESOLVED' },
      });
    }
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: `MODERATION_${input.action}`,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: { reportId: input.reportId ?? null, notes: input.notes ?? null },
      },
    });
    if (target.authorId && input.action !== 'DISMISS') {
      await this.notifications.notify({
        userId: target.authorId,
        type: 'MODERATION',
        title: 'Moderation update',
        body: 'A moderator reviewed a report involving your account',
        preference: 'moderation',
        data: { action: input.action },
      });
    }
    return { id: action.id, action: action.action };
  }

  private async removeContent(type: ReportTargetType, id: string) {
    const deletedAt = new Date();
    if (type === 'POST') await this.prisma.post.updateMany({ where: { id }, data: { deletedAt } });
    else if (type === 'COMMENT') await this.prisma.comment.updateMany({ where: { id }, data: { deletedAt } });
    else if (type === 'QUESTION') await this.prisma.question.updateMany({ where: { id }, data: { deletedAt } });
    else if (type === 'ANSWER') await this.prisma.answer.updateMany({ where: { id }, data: { deletedAt } });
    else if (type === 'EVENT') await this.prisma.event.updateMany({ where: { id }, data: { deletedAt, status: 'CANCELLED' } });
    else if (type === 'COMMUNITY') await this.prisma.community.updateMany({ where: { id }, data: { deletedAt } });
    else throw new AppError(400, 'INVALID_TARGET', 'That target cannot be removed this way');
  }

  private async lookup(type: ReportTargetType, id: string): Promise<TargetRef> {
    if (type === 'POST') {
      const row = await this.prisma.post.findUnique({ where: { id } });
      if (!row) throw notFound('Content not found');
      return { authorId: row.authorId, collegeId: row.collegeId, communityId: row.communityId };
    }
    if (type === 'COMMENT') {
      const row = await this.prisma.comment.findUnique({ where: { id }, include: { post: true } });
      if (!row) throw notFound('Content not found');
      return { authorId: row.authorId, collegeId: row.post.collegeId, communityId: row.post.communityId };
    }
    if (type === 'QUESTION') {
      const row = await this.prisma.question.findUnique({ where: { id } });
      if (!row) throw notFound('Content not found');
      return { authorId: row.authorId, collegeId: row.collegeId, communityId: row.communityId };
    }
    if (type === 'ANSWER') {
      const row = await this.prisma.answer.findUnique({ where: { id }, include: { question: true } });
      if (!row) throw notFound('Content not found');
      return { authorId: row.authorId, collegeId: row.question.collegeId, communityId: row.question.communityId };
    }
    if (type === 'EVENT') {
      const row = await this.prisma.event.findUnique({ where: { id } });
      if (!row) throw notFound('Content not found');
      return { authorId: row.organizerId, collegeId: row.collegeId, communityId: null };
    }
    if (type === 'COMMUNITY') {
      const row = await this.prisma.community.findUnique({ where: { id } });
      if (!row) throw notFound('Content not found');
      return { authorId: row.createdById, collegeId: row.collegeId, communityId: row.id };
    }
    const row = await this.prisma.user.findUnique({ where: { id } });
    if (!row) throw notFound('Content not found');
    return { authorId: row.id, collegeId: row.collegeId, communityId: null };
  }
}
