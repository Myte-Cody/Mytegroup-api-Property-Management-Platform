import { BadRequestException, Injectable } from '@nestjs/common';
import { MarketingChatMessageDto } from '../marketing-chat/dto/marketing-chat-message.dto';
import { MarketingChatService } from '../marketing-chat/marketing-chat.service';

@Injectable()
export class AiChatService {
  constructor(private readonly marketingChatService: MarketingChatService) {}

  async handleChat(
    channel: string,
    messages: MarketingChatMessageDto[],
    opts?: { maxWords?: number; maxOutputTokens?: number },
  ): Promise<string> {
    switch (channel) {
      case 'landing-marketing':
        return this.marketingChatService.generateReply(messages, opts);
      default:
        throw new BadRequestException('Unsupported chat channel');
    }
  }

  async *handleChatStream(
    channel: string,
    messages: MarketingChatMessageDto[],
    opts?: { maxWords?: number; maxOutputTokens?: number },
  ): AsyncGenerator<string> {
    switch (channel) {
      case 'landing-marketing':
        yield* this.marketingChatService.streamReply(messages, opts);
        return;
      default:
        throw new BadRequestException('Unsupported chat channel');
    }
  }
}

