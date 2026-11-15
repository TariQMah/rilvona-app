import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createAnswerSchema,
  createQuestionSchema,
  CreateAnswerInput,
  CreateQuestionInput,
  cursorQuerySchema,
  identityRevealSchema,
  voteSchema,
} from '@hiihive/contracts';
import { Request } from 'express';
import { z } from 'zod';
import { Verified } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { ZodPipe } from '../common/zod.pipe';
import { QuestionsService } from './questions.service';

@ApiTags('questions')
@ApiBearerAuth()
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(cursorQuerySchema)) query: { cursor?: string; limit: number }) {
    return this.questions.list(user, query.cursor, query.limit);
  }

  @Verified()
  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createQuestionSchema)) body: CreateQuestionInput) {
    return this.questions.create(user, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.questions.get(user, id);
  }

  @Verified()
  @Post(':id/answers')
  answer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(createAnswerSchema)) body: CreateAnswerInput,
  ) {
    return this.questions.answer(user, id, body);
  }

  @Verified()
  @Post(':id/accept')
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(z.object({ answerId: z.string().uuid() }))) body: { answerId: string },
  ) {
    return this.questions.accept(user, id, body.answerId);
  }
}

@ApiTags('answers')
@ApiBearerAuth()
@Controller('answers')
export class AnswersController {
  constructor(private readonly questions: QuestionsService) {}

  @Verified()
  @Post(':id/vote')
  vote(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(voteSchema)) body: z.infer<typeof voteSchema>,
  ) {
    return this.questions.vote(user, id, body.value);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/questions')
export class QuestionAdminController {
  constructor(private readonly questions: QuestionsService) {}

  @Post(':id/identity')
  identity(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(identityRevealSchema)) body: z.infer<typeof identityRevealSchema>,
    @Req() req: Request,
  ) {
    return this.questions.identity(user, id, body.reason, req.ip);
  }
}
