import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { aiChatSchema, AiChatInput } from '@hiihive/contracts';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { ZodPipe } from '../common/zod.pipe';
import { AiService } from './ai.service';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** One question to the student's AI helper, with the conversation so far. Nothing is stored on the server. */
  @Post('chat')
  chat(@CurrentUser() user: AuthUser, @Body(new ZodPipe(aiChatSchema)) body: AiChatInput) {
    return this.ai.chat(user.id, body);
  }
}
