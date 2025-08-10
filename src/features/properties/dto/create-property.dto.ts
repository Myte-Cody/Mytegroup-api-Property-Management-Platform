import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  ValidateNested,
  MaxLength,
  IsMongoId,
  IsArray,
} from "class-validator";
import { Type } from "class-transformer";
import { Types } from "mongoose";

class AddressDto {
  @IsString()
  @IsNotEmpty()
  street: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @IsString()
  @IsNotEmpty()
  country: string;
}

export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @IsString()
  @IsOptional()
  @MaxLength(1024)
  description?: string;

  @IsMongoId()
  @IsNotEmpty()
  owner: Types.ObjectId;

  @IsEnum(["Active", "Inactive", "Archived"])
  @IsOptional()
  status?: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  units?: Types.ObjectId[];
}
