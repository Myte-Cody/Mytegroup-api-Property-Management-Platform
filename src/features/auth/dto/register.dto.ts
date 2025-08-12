import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({ example: 'johndoe', description: 'Unique username for the user' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username: string;

  @ApiProperty({ example: 'john.doe@example.com', description: 'Email address of the user' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ 
    example: 'StrongP@ss123', 
    description: 'Password must contain at least 8 characters, including uppercase, lowercase, and numbers or special characters' 
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: "Password is too weak",
  })
  password: string;

  @ApiProperty({ example: '+1234567890', description: 'Phone number of the user', required: false })
  @IsString()
  @IsOptional()
  phone?: string;
}
