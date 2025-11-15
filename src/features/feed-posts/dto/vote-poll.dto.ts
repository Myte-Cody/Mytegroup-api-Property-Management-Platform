import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty } from 'class-validator';

export class VotePollDto {
  @ApiProperty({
    description: 'Poll option IDs to vote for',
    type: String,
    example: '673d8b8f123456789abcdef0',
  })
  @IsNotEmpty()
  @IsMongoId()
  optionId: string;
}
