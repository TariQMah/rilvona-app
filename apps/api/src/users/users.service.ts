import { Inject, Injectable } from '@nestjs/common';
import { UpdateProfileInput, NotificationPrefsInput } from '@hiihive/contracts';
import { AuthUser } from '../common/auth-user';
import { AppError, conflict, notFound } from '../common/errors';
import { AppConfig, APP_CONFIG } from '../config/env';
import { AccessService } from '../access/access.service';
import { canViewProfile } from '../access/policy';
import { PrismaService } from '../prisma/prisma.service';

const profileInclude = {
  profile: true,
  college: { select: { id: true, name: true, slug: true } },
  notificationPrefs: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: profileInclude });
    if (!user || !user.profile) throw notFound('Account not found');
    const verification = await this.access.latestVerification(userId);
    return this.privateProfile(user, verification?.status ?? 'UNVERIFIED');
  }

  async updateMe(userId: string, input: UpdateProfileInput) {
    if (input.avatarUrl) this.assertOwnAvatar(input.avatarUrl);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { profile: { update: input } },
      include: profileInclude,
    });
    const verification = await this.access.latestVerification(userId);
    return this.privateProfile(user, verification?.status ?? 'UNVERIFIED');
  }

  async updateNotifications(userId: string, input: NotificationPrefsInput) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: input,
      create: { userId, ...input },
    });
  }

  async publicProfile(viewer: AuthUser | null, username: string) {
    const user = await this.prisma.user.findFirst({
      where: { profile: { username } },
      include: { profile: true, college: { select: { id: true, name: true, slug: true } } },
    });
    if (!user?.profile) throw notFound('Profile not found');
    const blocked = viewer ? await this.access.isBlocked(viewer.id, user.id) : false;
    const verification = await this.access.latestVerification(user.id);
    const visible = canViewProfile({
      viewer,
      blocked,
      profile: {
        userId: user.id,
        visibility: user.profile.profileVisibility,
        collegeId: user.collegeId,
        deleted: user.status === 'DELETED',
      },
    });
    if (!visible) throw notFound('Profile not found');
    return {
      id: user.id,
      displayName: user.profile.displayName,
      username: user.profile.username,
      bio: user.profile.bio,
      avatarUrl: user.profile.avatarUrl,
      course: user.profile.course,
      graduationYear: user.profile.graduationYear,
      interests: user.profile.interests,
      skills: user.profile.skills,
      college: user.college,
      verificationStatus: verification?.status ?? 'UNVERIFIED',
    };
  }

  async block(userId: string, username: string) {
    const target = await this.findByUsername(username);
    if (target.id === userId) throw new AppError(400, 'INVALID_BLOCK', 'You cannot block yourself');
    await this.prisma.blockedUser.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: target.id } },
      update: {},
      create: { blockerId: userId, blockedId: target.id },
    });
    return { blocked: true };
  }

  async unblock(userId: string, username: string) {
    const target = await this.findByUsername(username);
    await this.prisma.blockedUser.deleteMany({ where: { blockerId: userId, blockedId: target.id } });
    return { blocked: false };
  }

  async blocks(userId: string) {
    const rows = await this.prisma.blockedUser.findMany({
      where: { blockerId: userId },
      include: { blocked: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      username: row.blocked.profile?.username ?? '',
      displayName: row.blocked.profile?.displayName ?? 'Student',
      blockedAt: row.createdAt,
    }));
  }

  async exportAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        consents: true,
        verifications: { select: { id: true, collegeId: true, method: true, status: true, createdAt: true } },
        posts: { where: { deletedAt: null }, select: { id: true, body: true, createdAt: true } },
        comments: { where: { deletedAt: null }, select: { id: true, postId: true, body: true, createdAt: true } },
        questions: { where: { deletedAt: null }, select: { id: true, title: true, body: true, createdAt: true } },
        answers: { where: { deletedAt: null }, select: { id: true, questionId: true, body: true, createdAt: true } },
        registrations: true,
        memberships: true,
      },
    });
    if (!user) throw notFound('Account not found');
    return {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        collegeId: user.collegeId,
        createdAt: user.createdAt,
      },
      profile: user.profile,
      consents: user.consents,
      verifications: user.verifications,
      posts: user.posts,
      comments: user.comments,
      questions: user.questions,
      answers: user.answers,
      registrations: user.registrations,
      memberships: user.memberships,
    };
  }

  async deactivate(userId: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { status: 'DEACTIVATED', deactivatedAt: new Date(), tokenVersion: { increment: 1 } },
      }),
      this.prisma.refreshTokenSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: { actorId: userId, action: 'ACCOUNT_DEACTIVATED', targetType: 'USER', targetId: userId },
      }),
    ]);
    return { deactivated: true };
  }

  async deleteAccount(userId: string) {
    const tombstone = `d${userId.replace(/-/g, '').slice(0, 19)}`;
    await this.prisma.$transaction([
      this.prisma.refreshTokenSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.deviceToken.deleteMany({ where: { userId } }),
      this.prisma.lmsConnection.deleteMany({ where: { userId } }),
      this.prisma.userProfile.update({
        where: { userId },
        data: {
          displayName: 'Deleted student',
          username: tombstone,
          bio: null,
          avatarUrl: null,
          course: null,
          interests: [],
          skills: [],
          profileVisibility: 'PRIVATE',
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status: 'DELETED',
          deletedAt: new Date(),
          email: `deleted-${userId}@deleted.hiihive.invalid`,
          phone: null,
          passwordHash: 'deleted',
          googleId: null,
          tokenVersion: { increment: 1 },
        },
      }),
      this.prisma.auditLog.create({
        data: { actorId: userId, action: 'ACCOUNT_DELETED', targetType: 'USER', targetId: userId },
      }),
    ]);
    return { deleted: true };
  }

  private async findByUsername(username: string) {
    const user = await this.prisma.user.findFirst({ where: { profile: { username } } });
    if (!user || user.status === 'DELETED') throw notFound('Profile not found');
    return user;
  }

  private assertOwnAvatar(url: string) {
    if (!this.config.storagePublicBaseUrl || !url.startsWith(`${this.config.storagePublicBaseUrl}/`)) {
      throw new AppError(400, 'INVALID_AVATAR', 'Choose an image you uploaded');
    }
  }

  private privateProfile(
    user: {
      id: string;
      email: string;
      phone: string | null;
      role: string;
      status: string;
      collegeId: string | null;
      emailVerifiedAt: Date | null;
      profile: {
        displayName: string;
        username: string;
        bio: string | null;
        avatarUrl: string | null;
        course: string | null;
        graduationYear: number | null;
        interests: string[];
        skills: string[];
        profileVisibility: string;
      } | null;
      college: { id: string; name: string; slug: string } | null;
      notificationPrefs: {
        replies: boolean;
        community: boolean;
        events: boolean;
        moderation: boolean;
        security: boolean;
        lms: boolean;
        pushEnabled: boolean;
      } | null;
    },
    verificationStatus: string,
  ) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      emailVerified: Boolean(user.emailVerifiedAt),
      college: user.college,
      verificationStatus,
      profile: user.profile,
      notifications: user.notificationPrefs,
    };
  }
}

void conflict;
