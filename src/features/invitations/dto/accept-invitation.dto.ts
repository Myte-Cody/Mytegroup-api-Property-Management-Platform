import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @ApiProperty({
    description:
      'Name for the new tenant/entity (organization name or will be calculated from firstName + lastName)',
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'First name for the new user account',
    example: 'John',
    maxLength: 50,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  firstName: string;

  @ApiProperty({
    description: 'Last name for the new user account',
    example: 'Doe',
    maxLength: 50,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  lastName: string;

  @ApiProperty({
    description: 'Username for the new user account',
    example: 'johndoe',
    minLength: 3,
    maxLength: 64,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  username: string;

  @ApiPropertyOptional({
    description: 'Phone number for the new user account',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Category of the contractor (required for contractor invitations)',
    example: 'Plumbing',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category: string;

  @ApiProperty({
    description:
      'Password for the new user account (min 8 chars with uppercase, lowercase, and number/special char)',
    example: 'StrongP@ss123',
    minLength: 8,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number or special character',
  })
  password: string;
}
