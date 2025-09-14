import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

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
}