import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTenantDto {
  @ApiPropertyOptional({
    description: 'Name of the tenant',
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Phone number for the tenant',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
