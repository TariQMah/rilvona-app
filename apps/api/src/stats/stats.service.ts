import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const now = Date.now();
    const since = (days: number) => new Date(now - days * DAY);
    const live = { deletedAt: null };
    const [
      totalUsers,
      activeUsers,
      deactivatedUsers,
      emailVerified,
      collegeVerified,
      pendingVerifications,
      communities,
      posts,
      comments,
      questions,
      events,
      openReports,
      lmsConnections,
      androidDevices,
      iosDevices,
      today,
      week,
      month,
      recent,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: { not: 'DELETED' } } }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'DEACTIVATED' } }),
      this.prisma.user.count({ where: { status: { not: 'DELETED' }, emailVerifiedAt: { not: null } } }),
      this.prisma.collegeVerification.groupBy({ by: ['userId'], where: { status: 'VERIFIED' } }).then((rows) => rows.length),
      this.prisma.collegeVerification.count({ where: { status: 'PENDING' } }),
      this.prisma.community.count({ where: live }),
      this.prisma.post.count({ where: live }),
      this.prisma.comment.count({ where: live }),
      this.prisma.question.count({ where: live }),
      this.prisma.event.count(),
      this.prisma.report.count({ where: { status: { in: ['OPEN', 'REVIEWING'] } } }),
      this.prisma.lmsConnection.count({ where: { isDemo: false } }),
      this.prisma.deviceToken.count({ where: { platform: 'ANDROID' } }),
      this.prisma.deviceToken.count({ where: { platform: 'IOS' } }),
      this.prisma.user.count({ where: { createdAt: { gte: since(1) }, status: { not: 'DELETED' } } }),
      this.prisma.user.count({ where: { createdAt: { gte: since(7) }, status: { not: 'DELETED' } } }),
      this.prisma.user.count({ where: { createdAt: { gte: since(30) }, status: { not: 'DELETED' } } }),
      this.prisma.user.findMany({
        where: { status: { not: 'DELETED' } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          email: true,
          createdAt: true,
          googleId: true,
          emailVerifiedAt: true,
          college: { select: { name: true } },
          profile: { select: { displayName: true, username: true } },
        },
      }),
    ]);
    return {
      stats: {
        totalUsers,
        activeUsers,
        deactivatedUsers,
        emailVerified,
        collegeVerified,
        pendingVerifications,
        communities,
        posts,
        comments,
        questions,
        events,
        openReports,
        lmsConnections,
        androidDevices,
        iosDevices,
      },
      signups: { today, week, month },
      recentUsers: recent.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.profile?.displayName ?? null,
        username: user.profile?.username ?? null,
        college: user.college?.name ?? null,
        viaGoogle: Boolean(user.googleId),
        emailVerified: Boolean(user.emailVerifiedAt),
        createdAt: user.createdAt,
      })),
    };
  }
}
