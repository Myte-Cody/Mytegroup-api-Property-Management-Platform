import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class AddressDto {
  @IsString()
  @IsOptional()
  street?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  country?: string;
}

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsEmail()
  @IsOptional()
  @Matches(/.+\@.+\..+/)
  contactEmail?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;
}
