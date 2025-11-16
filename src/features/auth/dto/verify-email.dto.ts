import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class VerifyEmailRequestDto {
  // No body needed; operates on current user
}

export class VerifyEmailConfirmDto {
  @ApiPropertyOptional({ description: 'Email verification link token' })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional({ description: '6-digit verification code' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  code?: string;
}
