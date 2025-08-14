import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

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
  @ApiProperty({
    example: 'Sunset Apartments',
    description: 'Name of the property',
    maxLength: 128,
  })
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
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1024)
  description?: string;
}
