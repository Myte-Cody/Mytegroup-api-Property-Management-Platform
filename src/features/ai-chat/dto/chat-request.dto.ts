import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { MarketingChatMessageDto } from '../../marketing-chat/dto/marketing-chat-message.dto';

export class ChatRequestDto {
  @ApiProperty({
    example: 'landing-marketing',
    description: 'Channel routing key to select the appropriate AI persona/pipeline.',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['landing-marketing'])
  channel: string;

  @ApiProperty({
    type: [MarketingChatMessageDto],
    description: 'Conversation so far, starting with the earliest message.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => MarketingChatMessageDto)
  messages: MarketingChatMessageDto[];

  @ApiProperty({
    required: false,
    description: 'Soft word target for the assistant (e.g., 500).',
    example: 500,
  })
  @Type(() => Number)
  @IsOptional()
  maxWords?: number;

  @ApiProperty({
    required: false,
    description: 'Max output tokens for the assistant (hard cap).',
    example: 1000,
  })
  @Type(() => Number)
  @IsOptional()
  maxOutputTokens?: number;
}

