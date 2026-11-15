import { Injectable } from '@nestjs/common';
import { VerificationRequestInput, verificationReviewSchema } from '@hiihive/contracts';
import { z } from 'zod';
import { AuthUser } from '../common/auth-user';
import { forbidden, notFound } from '../common/errors';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollegesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  list() {
    return this.prisma.college.findMany({ orderBy: { name: 'asc' } });
  }

  async getBySlug(slug: string) {
    const college = await this.prisma.college.findUnique({ where: { slug } });
    if (!college) throw notFound('College not found');
    return college;
  }
}

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async request(user: AuthUser, input: VerificationRequestInput) {
    const account = await this.prisma.user.findUnique({ where: { id: user.id } });
    const college = await this.prisma.college.findUnique({ where: { id: input.collegeId } });
    if (!account || !college) throw notFound('College not found');
    if (!account.emailVerifiedAt) {
      throw forbidden('Verify your email before requesting college verification');
    }

    let status: 'PENDING' | 'VERIFIED' = 'PENDING';
    if (input.method === 'COLLEGE_EMAIL') {
      const domain = college.emailDomain?.toLowerCase();
      if (!domain || !account.email.endsWith(`@${domain}`)) {
        throw forbidden('That college requires a matching college email, or you can submit manual verification');
      }
      status = 'VERIFIED';
    } else if (!college.allowsManualVerification) {
      throw forbidden('This college does not accept manual verification');
    }

    const verification = await this.prisma.collegeVerification.create({
      data: {
        userId: user.id,
        collegeId: college.id,
        method: input.method,
        status,
        note: input.note,
        reviewedAt: status === 'VERIFIED' ? new Date() : null,
      },
    });
    if (status === 'VERIFIED') {
      await this.prisma.user.update({ where: { id: user.id }, data: { collegeId: college.id } });
    } else {
      await this.prisma.user.update({ where: { id: user.id }, data: { collegeId: college.id } });
    }
    return verification;
  }

  async mine(userId: string) {
    return this.prisma.collegeVerification.findMany({
      where: { userId },
      include: { college: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async queue(actor: AuthUser) {
    if (actor.role !== 'PLATFORM_ADMIN' && actor.role !== 'COLLEGE_ADMIN') throw forbidden();
    return this.prisma.collegeVerification.findMany({
      where: {
        status: 'PENDING',
        ...(actor.role === 'COLLEGE_ADMIN' ? { collegeId: actor.collegeId ?? 'none' } : {}),
      },
      include: {
        college: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, email: true, profile: { select: { displayName: true, username: true } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async review(actor: AuthUser, id: string, input: z.infer<typeof verificationReviewSchema>) {
    const verification = await this.prisma.collegeVerification.findUnique({ where: { id } });
    if (!verification) throw notFound('Verification request not found');
    const allowed =
      actor.role === 'PLATFORM_ADMIN' ||
      (actor.role === 'COLLEGE_ADMIN' && actor.collegeId === verification.collegeId);
    if (!allowed) throw forbidden();
    const updated = await this.prisma.collegeVerification.update({
      where: { id },
      data: {
        status: input.decision,
        note: input.note ?? verification.note,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
    });
    if (input.decision === 'VERIFIED') {
      await this.prisma.user.update({ where: { id: verification.userId }, data: { collegeId: verification.collegeId } });
    }
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'VERIFICATION_REVIEWED',
        targetType: 'VERIFICATION',
        targetId: id,
        metadata: { decision: input.decision },
      },
    });
    await this.notifications.notify({
      userId: verification.userId,
      type: 'MODERATION',
      title: 'Verification update',
      body: input.decision === 'VERIFIED' ? 'Your college affiliation was approved.' : 'Your college verification was not approved.',
      preference: 'moderation',
      data: { verificationId: id },
    });
    return updated;
  }
}
