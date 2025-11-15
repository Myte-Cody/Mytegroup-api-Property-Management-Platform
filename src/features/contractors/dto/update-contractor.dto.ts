import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateContractorDto {
  @ApiProperty({
    description: 'Name of the contractor',
    example: 'ABC Plumbing Services',
    minLength: 2,
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Category of the contractor',
    example: 'Plumbing',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}
