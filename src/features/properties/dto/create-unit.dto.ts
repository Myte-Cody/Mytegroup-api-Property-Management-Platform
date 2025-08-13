import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { UnitAvailabilityStatus, UnitType } from '../../../common/enums/unit.enum';

export class CreateUnitDto {
  @ApiProperty({
    example: '101',
    description: 'Unit number or identifier',
    maxLength: 32,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  unitNumber: string;

  @ApiProperty({
    example: '1',
    description: 'Floor number or level',
    maxLength: 16,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(16)
  floor?: string;

  @ApiProperty({
    example: 800,
    description: 'Size of the unit in square feet',
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  sizeSqFt?: number;

  @ApiProperty({
    example: UnitType.APARTMENT,
    description: 'Type of unit',
    enum: UnitType,
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(UnitType)
  type: UnitType;

  @ApiProperty({
    example: 2,
    description: 'Number of bedrooms',
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  bedrooms?: number;

  @ApiProperty({
    example: 1,
    description: 'Number of bathrooms',
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  bathrooms?: number;

  @ApiProperty({
    example: UnitAvailabilityStatus.VACANT,
    description: 'Current availability status of the unit',
    enum: UnitAvailabilityStatus,
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsEnum(UnitAvailabilityStatus)
  availabilityStatus?: UnitAvailabilityStatus;

  @ApiProperty({
    example: 1200,
    description: 'Monthly rent amount',
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  rentAmount?: number;

  @ApiProperty({
    example: 'Spacious apartment with balcony and mountain view',
    description: 'Description of the unit',
    maxLength: 1024,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1024)
  description?: string;

  @ApiProperty({
    example: ['60d21b4667d0d8992e610c85'],
    description: 'Array of tenant IDs associated with this unit',
    type: [String],
    required: false,
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  tenants?: string[];
}
