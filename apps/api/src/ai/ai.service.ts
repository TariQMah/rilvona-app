import { Inject, Injectable, Logger } from '@nestjs/common';
import { AiChatInput } from '@hiihive/contracts';
import { AcademicsService } from '../academics/academics.service';
import { AppError } from '../common/errors';
import { RateLimitService } from '../common/rate-limiter';
import { AppConfig, APP_CONFIG } from '../config/env';
import { buildAiContext, OverviewLike } from './ai-context';

export type AiChatResult = { reply: string; toolsUsed: string[] };

const NOT_CONNECTED =
  'Connect your university account first (tap the refresh icon on Home). Once your attendance and timetable are synced I can plan your classes, marks and study time with real numbers.';

/**
 * The student's AI helper. This API does the sign in, the limits and the data lookup; the Python service next to it
 * (apps/ai) holds the instructions, the calculations and the model key.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly academics: AcademicsService,
    private readonly limits: RateLimitService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async chat(userId: string, input: AiChatInput): Promise<AiChatResult> {
    await this.limits.consume(`ai:min:${userId}`, 8, 60_000, 'You are sending messages very fast. Wait a few seconds.');
    await this.limits.consume(`ai:day:${userId}`, 150, 24 * 60 * 60_000, 'You have used all of today’s AI messages. Come back tomorrow.');

    const overview = (await this.academics.overview(userId)) as unknown as OverviewLike;
    if (!overview.connected) return { reply: NOT_CONNECTED, toolsUsed: [] };

    if (!this.config.aiServiceKey) {
      this.logger.error('AI_SERVICE_KEY is not set');
      throw new AppError(503, 'AI_UNAVAILABLE', 'The assistant is not available right now.');
    }

    let response: Response;
    try {
      response = await fetch(`${this.config.aiServiceUrl}/v1/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-service-key': this.config.aiServiceKey },
        body: JSON.stringify({
          messages: input.messages,
          context: buildAiContext(overview, { clientTime: input.clientTime, timezone: input.timezone }),
        }),
        signal: AbortSignal.timeout(50_000),
      });
    } catch (error) {
      this.logger.error(`AI service unreachable: ${error instanceof Error ? error.message : String(error)}`);
      throw new AppError(503, 'AI_UNAVAILABLE', 'The assistant is resting for a moment. Try again shortly.');
    }
    if (!response.ok) {
      this.logger.error(`AI service answered ${response.status}`);
      throw new AppError(503, 'AI_UNAVAILABLE', 'The assistant is resting for a moment. Try again shortly.');
    }
    const body = (await response.json()) as Partial<AiChatResult>;
    if (typeof body.reply !== 'string' || !body.reply.trim()) {
      throw new AppError(503, 'AI_UNAVAILABLE', 'The assistant is resting for a moment. Try again shortly.');
    }
    return { reply: body.reply, toolsUsed: Array.isArray(body.toolsUsed) ? body.toolsUsed : [] };
  }
}
