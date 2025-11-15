import { Module } from '@nestjs/common';
import { MarketingChatModule } from '../marketing-chat/marketing-chat.module';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';

@Module({
  imports: [MarketingChatModule],
  controllers: [AiChatController],
  providers: [AiChatService],
})
export class AiChatModule {}

