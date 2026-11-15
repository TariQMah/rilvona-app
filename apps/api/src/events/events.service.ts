import { Injectable } from '@nestjs/common';
import { CreateEventInput } from '@hiihive/contracts';
import { AuthUser } from '../common/auth-user';
import { cursorFilter, decodeCursor, pageResult } from '../common/cursor';
import { AppError, conflict, forbidden, notFound } from '../common/errors';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(cursor: string | undefined, limit: number) {
    const decoded = cursor ? decodeCursor(cursor) : undefined;
    const rows = await this.prisma.event.findMany({
      where: {
        deletedAt: null,
        status: 'PUBLISHED',
        endsAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        ...cursorFilter(decoded, 'startsAt', 'asc'),
      },
      include: this.include(),
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const page = pageResult(rows, limit, (row) => row.startsAt);
    return { data: page.data.map((row) => this.present(row, null)), meta: page.meta };
  }

  async get(id: string, viewer: AuthUser | null) {
    const event = await this.prisma.event.findUnique({ where: { id }, include: this.include() });
    if (!event || event.deletedAt) throw notFound('Event not found');
    const registration = viewer
      ? await this.prisma.eventRegistration.findUnique({ where: { eventId_userId: { eventId: id, userId: viewer.id } } })
      : null;
    return this.present(event, registration?.status ?? null);
  }

  async create(user: AuthUser, input: CreateEventInput) {
    if (!user.emailVerified) throw new AppError(403, 'EMAIL_UNVERIFIED', 'Verify your email to continue');
    const recent = await this.prisma.event.count({
      where: { organizerId: user.id, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    if (recent >= 5 && user.role !== 'PLATFORM_ADMIN') {
      throw new AppError(429, 'RATE_LIMITED', 'You have created too many events today');
    }
    if (input.scope === 'INTERCOLLEGE' && user.role !== 'PLATFORM_ADMIN') throw forbidden();
    const collegeId = input.scope === 'INTERCOLLEGE' ? null : user.collegeId;
    if (input.scope === 'COLLEGE' && !collegeId) {
      throw new AppError(403, 'COLLEGE_REQUIRED', 'Select and verify a college before creating a college event');
    }
    const event = await this.prisma.event.create({
      data: {
        organizerId: user.id,
        collegeId,
        title: input.title,
        description: input.description,
        location: input.location,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        scope: input.scope,
        status: 'PUBLISHED',
        capacity: input.capacity ?? null,
        waitlistEnabled: input.waitlistEnabled,
      },
      include: this.include(),
    });
    return this.present(event, null);
  }

  async register(user: AuthUser, eventId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId}::uuid FOR UPDATE`;
      const event = await tx.event.findUnique({ where: { id: eventId } });
      if (!event || event.deletedAt || event.status !== 'PUBLISHED') throw notFound('Event not found');
      if (event.endsAt <= new Date()) throw new AppError(400, 'EVENT_CLOSED', 'Registration for this event is closed');
      const existing = await tx.eventRegistration.findUnique({
        where: { eventId_userId: { eventId, userId: user.id } },
      });
      if (existing && ['REGISTERED', 'WAITLISTED', 'ATTENDED'].includes(existing.status)) {
        throw conflict('ALREADY_REGISTERED', 'You are already registered for this event');
      }
      const taken = await tx.eventRegistration.count({ where: { eventId, status: 'REGISTERED' } });
      let status: 'REGISTERED' | 'WAITLISTED' = 'REGISTERED';
      if (event.capacity != null && taken >= event.capacity) {
        if (!event.waitlistEnabled) throw conflict('EVENT_FULL', 'This event is full');
        status = 'WAITLISTED';
      }
      const registration = existing
        ? await tx.eventRegistration.update({ where: { id: existing.id }, data: { status } })
        : await tx.eventRegistration.create({ data: { eventId, userId: user.id, status } });
      await this.notifications.notify({
        userId: user.id,
        type: 'REGISTRATION',
        title: status === 'REGISTERED' ? 'You are registered' : 'You are on the waitlist',
        body: event.title,
        preference: 'events',
        data: { eventId },
      });
      return { status: registration.status };
    });
  }

  async cancelRegistration(userId: string, eventId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId}::uuid FOR UPDATE`;
      const registration = await tx.eventRegistration.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });
      if (!registration || !['REGISTERED', 'WAITLISTED'].includes(registration.status)) {
        throw notFound('Registration not found');
      }
      await tx.eventRegistration.update({ where: { id: registration.id }, data: { status: 'CANCELLED' } });
      if (registration.status === 'REGISTERED') {
        const event = await tx.event.findUnique({ where: { id: eventId } });
        if (event?.waitlistEnabled) {
          const next = await tx.eventRegistration.findFirst({
            where: { eventId, status: 'WAITLISTED' },
            orderBy: { createdAt: 'asc' },
          });
          if (next) {
            await tx.eventRegistration.update({ where: { id: next.id }, data: { status: 'REGISTERED' } });
            await this.notifications.notify({
              userId: next.userId,
              type: 'REGISTRATION',
              title: 'A spot opened up',
              body: event.title,
              preference: 'events',
              data: { eventId },
            });
          }
        }
      }
      return { status: 'CANCELLED' };
    });
  }

  async checkIn(actor: AuthUser, eventId: string, targetUserId?: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event || event.deletedAt || event.status !== 'PUBLISHED') throw notFound('Event not found');
    const userId = targetUserId ?? actor.id;
    const organizer =
      actor.id === event.organizerId ||
      actor.role === 'PLATFORM_ADMIN' ||
      (actor.role === 'COLLEGE_ADMIN' && actor.collegeId === event.collegeId);
    if (userId !== actor.id && !organizer) throw forbidden();
    const now = Date.now();
    if (now < event.startsAt.getTime() - 30 * 60 * 1000 || now > event.endsAt.getTime() + 2 * 60 * 60 * 1000) {
      throw new AppError(400, 'CHECKIN_CLOSED', 'Check-in is only open around the event time');
    }
    const registration = await this.prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!registration || registration.status !== 'REGISTERED') {
      throw new AppError(400, 'NOT_REGISTERED', 'Only a registered student can be checked in');
    }
    await this.prisma.eventRegistration.update({ where: { id: registration.id }, data: { status: 'ATTENDED' } });
    return { status: 'ATTENDED' };
  }

  async cancelEvent(actor: AuthUser, eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, include: { registrations: true } });
    if (!event || event.deletedAt) throw notFound('Event not found');
    const allowed = actor.id === event.organizerId || actor.role === 'PLATFORM_ADMIN';
    if (!allowed) throw forbidden();
    await this.prisma.event.update({ where: { id: eventId }, data: { status: 'CANCELLED' } });
    for (const registration of event.registrations.filter((item) => item.status === 'REGISTERED' || item.status === 'WAITLISTED')) {
      await this.notifications.notify({
        userId: registration.userId,
        type: 'EVENT',
        title: 'Event cancelled',
        body: event.title,
        preference: 'events',
        data: { eventId },
      });
    }
    return { status: 'CANCELLED' };
  }

  private include() {
    return {
      organizer: { include: { profile: true } },
      college: { select: { id: true, name: true, slug: true } },
      _count: { select: { registrations: { where: { status: 'REGISTERED' as const } } } },
    };
  }

  private present(
    event: {
      id: string;
      title: string;
      description: string;
      location: string;
      startsAt: Date;
      endsAt: Date;
      scope: string;
      status: string;
      capacity: number | null;
      waitlistEnabled: boolean;
      college: { id: string; name: string; slug: string } | null;
      organizer: { id: string; profile: { displayName: string; username: string } | null };
      _count: { registrations: number };
    },
    myStatus: string | null,
  ) {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      scope: event.scope,
      status: event.status,
      capacity: event.capacity,
      waitlistEnabled: event.waitlistEnabled,
      registeredCount: event._count.registrations,
      college: event.college,
      organizer: {
        id: event.organizer.id,
        displayName: event.organizer.profile?.displayName ?? 'Student',
        username: event.organizer.profile?.username ?? 'student',
      },
      myStatus,
      sharePath: `/events/${event.id}`,
    };
  }
}
