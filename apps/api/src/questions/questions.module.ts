import { Module } from '@nestjs/common';
import { AnswersController, QuestionAdminController, QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

@Module({
  controllers: [QuestionsController, AnswersController, QuestionAdminController],
  providers: [QuestionsService],
})
export class QuestionsModule {}
