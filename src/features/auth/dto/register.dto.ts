import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: "Password is too weak",
  })
  password: string;

  @IsEnum(["Landlord", "Tenant", "Contractor", "Admin"])
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
