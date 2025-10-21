import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateScopeOfWorkDto {
  @ApiProperty({
    description: 'List of maintenance ticket IDs to include in the scope of work',
    example: ['673d8b8f123456789abcdef0', '673d8b8f123456789abcdef1'],
    type: [String],
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsNotEmpty()
  tickets: string[];

  @ApiPropertyOptional({
    description: 'Parent scope of work ID (if this SOW is a child of another)',
    example: '673d8b8f123456789abcdef2',
  })
  @IsOptional()
  @IsMongoId()
  parentSow?: string;
}
