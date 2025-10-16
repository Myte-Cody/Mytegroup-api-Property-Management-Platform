import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsMongoId, IsNotEmpty } from 'class-validator';

export class VotePollDto {
  @ApiProperty({
    description: 'Poll option IDs to vote for',
    type: [String],
    example: ['673d8b8f123456789abcdef0'],
  })
  @IsArray()
  @IsNotEmpty()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  optionIds: string[];
}
