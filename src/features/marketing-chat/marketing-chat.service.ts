import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { MYTE_ESTATES_PERSONA_PROMPT } from '../ai-chat/personas/myte-estates.persona';
import { MarketingChatMessageDto } from './dto/marketing-chat-message.dto';

function buildMarketingSystemPrompt(maxWords: number): string {
  return `${MYTE_ESTATES_PERSONA_PROMPT}

Context for this chat (landing page)
- You are speaking to someone who is exploring the product.
- Explain what exists today and how to use it.
- Suggest how the free shared workspace tier fits their situation.
- Do not promise custom work. Invite them to book a call if they ask for custom features.
- You cannot access or change any live data here. You only explain and help them plan.
- Do not use em dashes in your writing.

Product facts you can reference
- Roles: owners, staff, tenants, and contractors have separate lanes.
- Leases and rent: rent roll, renewals, deposits, and transactions.
- Maintenance: ticket statuses include OPEN, ASSIGNED, IN_PROGRESS, IN_REVIEW, DONE, CLOSED.
- Storage: S3 in production or local disk in development, with signed links when needed.
- Security: HttpOnly cookies for auth, CSRF protection, and policy based permissions.

Formatting
- Use clean Markdown when it helps: short headings, bullet lists, and small tables.
- Keep it conversational and easy to scan.
- Aim for about ${maxWords} words unless the user asks for more.`;
}

@Injectable()
export class MarketingChatService {
  private readonly logger = new Logger(MarketingChatService.name);
  private readonly openAi?: OpenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.model = this.configService.get<string>('OPENAI_MARKETING_MODEL') ?? 'gpt-5.1';

    if (apiKey) {
      this.openAi = new OpenAI({ apiKey });
    }
  }

  async generateReply(
    messages: MarketingChatMessageDto[],
    opts?: { maxWords?: number; maxOutputTokens?: number },
  ): Promise<string> {
    if (!this.openAi) {
      this.logger.warn('OPENAI_API_KEY not configured. Using marketing chat fallback.');
      return this.buildFallback(messages);
    }

    try {
      const maxWords = opts?.maxWords && opts.maxWords > 0 ? Math.min(opts.maxWords, 2000) : 500;
      const maxOutputTokens =
        opts?.maxOutputTokens && opts.maxOutputTokens > 0
          ? Math.min(opts.maxOutputTokens, 4000)
          : 1000;
      const conversation = messages
        .map((message) => {
          const speaker = message.role === 'user' ? 'User' : 'Assistant';
          return `${speaker}: ${message.content}`;
        })
        .join('\n');

      const response = await this.openAi.responses.create({
        model: this.model,
        max_output_tokens: maxOutputTokens,
        input: `${buildMarketingSystemPrompt(maxWords)}\n\nConversation so far:\n${conversation}\n\nRespond as MYTE Estates in a concise, friendly tone.`,
      });

      const reply = response.output_text;
      if (!reply || !reply.trim()) {
        this.logger.warn('Empty reply from OpenAI for marketing chat. Falling back.');
        return this.buildFallback(messages);
      }

      return reply.trim();
    } catch (error: any) {
      this.logger.error(`Marketing chat OpenAI error: ${error.message}`, error.stack);
      return this.buildFallback(messages);
    }
  }

  async *streamReply(
    messages: MarketingChatMessageDto[],
    opts?: { maxWords?: number; maxOutputTokens?: number },
  ): AsyncGenerator<string> {
    if (!this.openAi) {
      this.logger.warn('OPENAI_API_KEY not configured. Using marketing chat fallback (stream).');
      yield this.buildFallback(messages);
      return;
    }

    try {
      const maxWords = opts?.maxWords && opts.maxWords > 0 ? Math.min(opts.maxWords, 2000) : 500;
      const maxOutputTokens =
        opts?.maxOutputTokens && opts.maxOutputTokens > 0
          ? Math.min(opts.maxOutputTokens, 4000)
          : 1000;
      const conversation = messages
        .map((message) => {
          const speaker = message.role === 'user' ? 'User' : 'Assistant';
          return `${speaker}: ${message.content}`;
        })
        .join('\n');

      const stream = await this.openAi.responses.create({
        model: this.model,
        max_output_tokens: maxOutputTokens,
        input: `${buildMarketingSystemPrompt(maxWords)}\n\nConversation so far:\n${conversation}\n\nRespond as MYTE Estates in a concise, friendly tone.`,
        stream: true,
      });

      // The OpenAI SDK returns an AsyncIterable of ResponseStreamEvent items.
      // We forward only the incremental text deltas.
      for await (const event of stream as any) {
        if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
          yield event.delta;
        }
      }
    } catch (error: any) {
      this.logger.error(`Marketing chat OpenAI streaming error: ${error.message}`, error.stack);
      yield this.buildFallback(messages);
    }
  }

  private buildFallback(messages: MarketingChatMessageDto[]): string {
    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');

    const intro =
      'I’m MYTE Estates, the landing-page guide. I can’t reach the full AI stack right now, but here’s the high-level idea:';

    const core = [
      '• Owners get a calm workspace for leases, rent, tickets, and vendors.',
      '• Tenants get a simple way to submit issues and see status.',
      '• Service pros see scoped jobs, not your whole portfolio.',
      '• The shared product is free for land owners, with optional deeper automation later.',
    ].join('\n');

    if (!latestUserMessage) {
      return `${intro}\n\n${core}`;
    }

    return `${intro}\n\nYou asked:\n“${latestUserMessage.content.slice(0, 280)}”\n\n${core}`;
  }
}
