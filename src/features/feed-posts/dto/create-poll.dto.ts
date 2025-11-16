import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePollDto {
  @ApiProperty({
    description: 'Poll options (array of option texts)',
    type: [String],
    example: ['Option 1', 'Option 2', 'Option 3'],
    minItems: 2,
  })
  @IsArray()
  @IsNotEmpty()
  @ArrayMinSize(2)
  @IsString({ each: true })
  options: string[];

  @ApiPropertyOptional({
    description: 'Allow multiple votes per user',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  allowMultipleVotes?: boolean;
}
