import {
  IsEmail,
  IsString,
  IsOptional,
  IsMongoId,
  IsBoolean,
} from "class-validator";

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsMongoId()
  organization?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
