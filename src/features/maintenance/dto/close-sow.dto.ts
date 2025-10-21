import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CloseSowDto {
  @ApiPropertyOptional({
    description: 'Notes about closing the scope of work',
    maxLength: 1000,
    example: 'All work has been completed successfully',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
