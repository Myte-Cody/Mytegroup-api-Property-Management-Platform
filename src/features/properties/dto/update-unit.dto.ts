import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { UnitType } from '../../../common/enums/unit.enum';

export class UpdateUnitDto {
  @ApiProperty({
    example: '101A',
    description: 'Unit number or identifier',
    maxLength: 32,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  unitNumber?: string;

  @ApiProperty({
    example: 850,
    description: 'Size of the unit in square feet',
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  size?: number;

  @ApiProperty({
    example: UnitType.APARTMENT,
    description: 'Type of unit',
    enum: UnitType,
    required: false,
  })
  @IsOptional()
  @IsEnum(UnitType)
  type?: UnitType;

  @ApiProperty({
    example: 'https://maps.google.com/?q=40.7128,-74.0060',
    description: 'Google Maps link for the unit location',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  googleMapsLink?: string;

  @ApiProperty({
    example: false,
    description: 'Whether the unit is available for rent',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  availableForRent?: boolean;

  @ApiProperty({
    example: '2025-11-01',
    description:
      'Date when the unit becomes available for rent (required if availableForRent is true)',
    required: false,
  })
  @ValidateIf((o) => o.availableForRent === true)
  @IsNotEmpty({ message: 'availableFrom is required when availableForRent is true' })
  @IsDateString()
  availableFrom?: string;

  @ApiProperty({
    example: false,
    description: 'Whether to publish the unit to the marketplace',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  publishToMarketplace?: boolean;

  @ApiProperty({
    example: 1500,
    description: 'Market rent amount (required if publishToMarketplace is true)',
    required: false,
    minimum: 0,
  })
  @ValidateIf((o) => o.publishToMarketplace === true)
  @IsNotEmpty({ message: 'marketRent is required when publishToMarketplace is true' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  marketRent?: number;
}
