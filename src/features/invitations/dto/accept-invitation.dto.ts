import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

/**
 * DTO for accepting an invitation.
 * All fields are optional because:
 * - For existing users: No fields are needed (just adds landlord to their landlords array)
 * - For new users: All fields except phone and category are required
 *
 * The validation is conditional based on whether the user already exists,
 * which is handled in the strategy layer.
 */
export class AcceptInvitationDto {
  @ApiPropertyOptional({
    description:
      'Name for the new tenant/entity (organization name or will be calculated from firstName + lastName). Required for new users.',
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.name !== undefined && o.name !== '')
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'First name for the new user account. Required for new users.',
    example: 'John',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name for the new user account. Required for new users.',
    example: 'Doe',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Username for the new user account. Required for new users.',
    example: 'johndoe',
    minLength: 3,
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.username !== undefined && o.username !== '')
  @MinLength(3)
  @MaxLength(64)
  username?: string;

  @ApiPropertyOptional({
    description: 'Phone number for the new user account',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Category of the contractor (required for new contractor invitations)',
    example: 'Plumbing',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({
    description:
      'Password for the new user account (min 8 chars with uppercase, lowercase, and number/special char). Required for new users.',
    example: 'StrongP@ss123',
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.password !== undefined && o.password !== '')
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number or special character',
  })
  password?: string;
}
