import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  MaxLength,
  IsMongoId,
  IsArray,
} from "class-validator";
import { Types } from "mongoose";

export class CreateUnitDto {
  @IsMongoId()
  @IsNotEmpty()
  property: Types.ObjectId;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  unitNumber: string;

  @IsString()
  @IsOptional()
  @MaxLength(16)
  floor?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  sizeSqFt?: number;

  @IsString()
  @IsNotEmpty()
  @IsEnum(["Apartment", "Studio", "Office", "Retail", "Room", "Other"])
  type: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bedrooms?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bathrooms?: number;

  @IsString()
  @IsOptional()
  @IsEnum(["Vacant", "Occupied", "Available for Rent"])
  availabilityStatus?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  rentAmount?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1024)
  description?: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  tenants?: Types.ObjectId[];
}
