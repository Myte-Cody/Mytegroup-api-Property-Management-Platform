import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  MaxLength,
  IsMongoId,
} from "class-validator";
import { Type } from "class-transformer";
import { Types } from "mongoose";
import { ApiProperty } from "@nestjs/swagger";

class AddressDto {
  @ApiProperty({ example: '123 Main St', description: 'Street address' })
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty({ example: 'New York', description: 'City name' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'NY', description: 'State or province' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ example: '10001', description: 'Postal or ZIP code' })
  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @ApiProperty({ example: 'USA', description: 'Country name' })
  @IsString()
  @IsNotEmpty()
  country: string;
}

export class CreatePropertyDto {
  @ApiProperty({ example: 'Sunset Apartments', description: 'Name of the property', maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name: string;

  @ApiProperty({ type: AddressDto, description: 'Property address details' })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @ApiProperty({ 
    example: 'A beautiful property with mountain views', 
    description: 'Description of the property', 
    maxLength: 1024,
    required: false
  })
  @IsString()
  @IsOptional()
  @MaxLength(1024)
  description?: string;

  @ApiProperty({ 
    example: '60d21b4667d0d8992e610c85', 
    description: 'Organization ID that owns this property' 
  })
  @IsMongoId()
  @IsNotEmpty()
  owner: Types.ObjectId;
}
