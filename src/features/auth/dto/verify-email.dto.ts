import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class VerifyEmailRequestDto {
  @ApiPropertyOptional({
    description:
      'Email address of the account to resend verification for. Optional if authenticated or token is provided.',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description:
      'Existing verification token from the email link. Optional if authenticated or email is provided.',
  })
  @IsOptional()
  @IsString()
  token?: string;
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
