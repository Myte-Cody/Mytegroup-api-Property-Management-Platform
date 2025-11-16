import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class MarketingChatMessageDto {
  @ApiProperty({ enum: ['assistant', 'user'], example: 'user' })
  @IsString()
  @IsIn(['assistant', 'user'])
  role: 'assistant' | 'user';

  @ApiProperty({
    example: 'I own a small triplex and want help structuring maintenance.',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
