import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateTenantUserDto {
  @ApiProperty({
    example: 'johndoe',
    description: 'Unique username for the tenant user',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address of the tenant user',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'Phone number of the tenant user',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    example: 'StrongP@ss123',
    description:
      'Password must contain at least 8 characters, including uppercase, lowercase, and numbers or special characters',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password is too weak',
  })
  password: string;

  @ApiProperty({
    example: false,
    description: 'Whether this user is the primary user',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
