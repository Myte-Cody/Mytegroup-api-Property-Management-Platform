import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { MarketingChatMessageDto } from '../../marketing-chat/dto/marketing-chat-message.dto';

export class LandingChatFeedbackDto {
  @ApiProperty({
    example: 'owner@example.com',
    description: 'Email address to associate with this feedback and to send confirmation to.',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'landing-marketing',
    description: 'Channel key, used for routing / analysis context.',
  })
  @IsString()
  @IsNotEmpty()
  channel: string;

  @ApiProperty({
    example: 'Ash',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    type: [MarketingChatMessageDto],
    description: 'Conversation so far, starting with the earliest message.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => MarketingChatMessageDto)
  conversation: MarketingChatMessageDto[];
}

