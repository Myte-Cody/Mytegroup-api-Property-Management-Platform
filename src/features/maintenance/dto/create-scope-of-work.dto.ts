import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateScopeOfWorkDto {
  @ApiProperty({
    description: 'Title of the scope of work',
    example: 'Building A - HVAC System Maintenance',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the scope of work',
    example:
      'Complete maintenance and inspection of HVAC systems including filter replacement, duct cleaning, and performance testing.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    description: 'List of maintenance ticket IDs to include in the scope of work',
    example: ['673d8b8f123456789abcdef0', '673d8b8f123456789abcdef1'],
    type: [String],
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsNotEmpty()
  tickets: string[];
}
