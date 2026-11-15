import { Injectable } from '@nestjs/common';
import { CreateAnswerInput, CreateQuestionInput } from '@hiihive/contracts';
import { AuthUser } from '../common/auth-user';
import { cursorFilter, decodeCursor, pageResult } from '../common/cursor';
import { AppError, forbidden, notFound } from '../common/errors';
import { makePseudonym } from '../common/pseudonym';
import { RateLimitService } from '../common/rate-limiter';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: RateLimitService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, cursor: string | undefined, limit: number) {
    const decoded = cursor ? decodeCursor(cursor) : undefined;
    const memberships = await this.prisma.communityMembership.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      select: { communityId: true },
    });
    const ids = memberships.map((row) => row.communityId);
    const rows = await this.prisma.question.findMany({
      where: {
        deletedAt: null,
        AND: [
          cursorFilter(decoded, 'createdAt', 'desc'),
          {
            OR: [
              { communityId: null, OR: [{ collegeId: null }, { collegeId: user.collegeId }] },
              { community: { visibility: 'PUBLIC', deletedAt: null } },
              ...(ids.length ? [{ communityId: { in: ids } }] : []),
            ],
          },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { _count: { select: { answers: { where: { deletedAt: null } } } } },
    });
    const page = pageResult(rows, limit, (row) => row.createdAt);
    return {
      data: page.data.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        pseudonym: row.pseudonym,
        createdAt: row.createdAt,
        answerCount: row._count.answers,
        accepted: Boolean(row.acceptedAnswerId),
        askedByMe: row.authorId === user.id,
      })),
      meta: page.meta,
    };
  }

  async create(user: AuthUser, input: CreateQuestionInput) {
    await this.limits.consume(`question:${user.id}`, 5, 60 * 60 * 1000, 'You are asking too quickly. Try again later.');
    if (input.communityId) {
      const membership = await this.prisma.communityMembership.findUnique({
        where: { communityId_userId: { communityId: input.communityId, userId: user.id } },
      });
      if (membership?.status !== 'ACTIVE') throw forbidden('Join this community before asking there');
    }
    const question = await this.prisma.question.create({
      data: {
        authorId: user.id,
        collegeId: user.collegeId,
        communityId: input.communityId,
        title: input.title,
        body: input.body,
        pseudonym: makePseudonym(),
      },
    });
    return this.publicQuestion(question, [], true);
  }

  async get(user: AuthUser, id: string) {
    const question = await this.loadVisible(user, id);
    const answers = await this.prisma.answer.findMany({
      where: { questionId: id, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }],
      take: 100,
    });
    return this.publicQuestion(question, answers, question.authorId === user.id);
  }

  async answer(user: AuthUser, questionId: string, input: CreateAnswerInput) {
    await this.loadVisible(user, questionId);
    const answer = await this.prisma.answer.create({
      data: { questionId, authorId: user.id, body: input.body, pseudonym: makePseudonym() },
    });
    return {
      id: answer.id,
      body: answer.body,
      pseudonym: answer.pseudonym,
      score: answer.score,
      createdAt: answer.createdAt,
      accepted: false,
    };
  }

  async vote(user: AuthUser, answerId: string, value: 1 | -1) {
    const answer = await this.prisma.answer.findUnique({ where: { id: answerId } });
    if (!answer || answer.deletedAt) throw notFound('Answer not found');
    await this.loadVisible(user, answer.questionId);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.answerVote.upsert({
        where: { answerId_userId: { answerId, userId: user.id } },
        update: { value },
        create: { answerId, userId: user.id, value },
      });
      const aggregate = await tx.answerVote.aggregate({ where: { answerId }, _sum: { value: true } });
      return tx.answer.update({ where: { id: answerId }, data: { score: aggregate._sum.value ?? 0 } });
    });
    return { id: updated.id, score: updated.score, value };
  }

  async accept(user: AuthUser, questionId: string, answerId: string) {
    const question = await this.loadVisible(user, questionId);
    if (question.authorId !== user.id) throw forbidden('Only the person who asked can accept an answer');
    const answer = await this.prisma.answer.findFirst({ where: { id: answerId, questionId, deletedAt: null } });
    if (!answer) throw notFound('Answer not found');
    await this.prisma.question.update({ where: { id: questionId }, data: { acceptedAnswerId: answerId } });
    await this.notifications.notify({
      userId: answer.authorId,
      type: 'REPLY',
      title: 'Your answer was accepted',
      body: 'An answer you wrote was marked helpful',
      preference: 'replies',
      data: { questionId },
    });
    return { acceptedAnswerId: answerId };
  }

  async identity(actor: AuthUser, questionId: string, reason: string, ip?: string) {
    if (actor.role !== 'PLATFORM_ADMIN') throw forbidden();
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { author: { include: { profile: true } } },
    });
    if (!question) throw notFound('Question not found');
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'IDENTITY_REVEALED',
        targetType: 'QUESTION',
        targetId: questionId,
        ip,
        metadata: { reason },
      },
    });
    return {
      userId: question.authorId,
      email: question.author.email,
      username: question.author.profile?.username ?? null,
    };
  }

  private async loadVisible(user: AuthUser, id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: { community: true },
    });
    if (!question || question.deletedAt || question.community?.deletedAt) throw notFound('Question not found');
    if (question.community?.visibility === 'RESTRICTED') {
      const membership = await this.prisma.communityMembership.findUnique({
        where: { communityId_userId: { communityId: question.community.id, userId: user.id } },
      });
      if (membership?.status !== 'ACTIVE' && user.role !== 'PLATFORM_ADMIN' && question.authorId !== user.id) {
        throw notFound('Question not found');
      }
    }
    return question;
  }

  private publicQuestion(
    question: { id: string; title: string; body: string; pseudonym: string; createdAt: Date; acceptedAnswerId: string | null },
    answers: { id: string; body: string; pseudonym: string; score: number; createdAt: Date }[],
    askedByMe: boolean,
  ) {
    return {
      id: question.id,
      title: question.title,
      body: question.body,
      pseudonym: question.pseudonym,
      createdAt: question.createdAt,
      acceptedAnswerId: question.acceptedAnswerId,
      askedByMe,
      answers: answers.map((answer) => ({
        id: answer.id,
        body: answer.body,
        pseudonym: answer.pseudonym,
        score: answer.score,
        createdAt: answer.createdAt,
        accepted: answer.id === question.acceptedAnswerId,
      })),
    };
  }
}

void AppError;
