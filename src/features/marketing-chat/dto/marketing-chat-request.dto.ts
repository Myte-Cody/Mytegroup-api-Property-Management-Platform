import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { MarketingChatMessageDto } from './marketing-chat-message.dto';

export class MarketingChatRequestDto {
  @ApiProperty({
    type: [MarketingChatMessageDto],
    description:
      'Conversation so far, starting with the earliest message. Roles must be either "user" or "assistant".',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => MarketingChatMessageDto)
  messages: MarketingChatMessageDto[];
}
