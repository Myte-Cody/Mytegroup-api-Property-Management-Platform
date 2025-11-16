import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MarketingChatController } from './marketing-chat.controller';
import { MarketingChatService } from './marketing-chat.service';

@Module({
  imports: [ConfigModule],
  controllers: [MarketingChatController],
  providers: [MarketingChatService],
  exports: [MarketingChatService],
})
export class MarketingChatModule {}
