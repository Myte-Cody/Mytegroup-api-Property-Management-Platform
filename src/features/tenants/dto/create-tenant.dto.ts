import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({
    description: 'Name of the tenant',
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
    description: 'Username for the tenant user account',
    example: 'johndoe',
    minLength: 3,
    maxLength: 64,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  username: string;

  @ApiProperty({
    description: 'Email address for the tenant user account',
    example: 'john.doe@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Password for the tenant user account',
    example: 'password123',
    minLength: 6,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;
}
