import { IsEmail, IsString, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateUserDto {
  @ApiProperty({
    example: "johndoe",
    description: "Username of the user",
    required: false,
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({
    example: "john.doe@example.com",
    description: "Email address of the user",
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: "StrongP@ss123",
    description: "Password of the user. Will be hashed before storage",
    required: false,
  })
  @IsOptional()
  @IsString()
  password?: string;
}
