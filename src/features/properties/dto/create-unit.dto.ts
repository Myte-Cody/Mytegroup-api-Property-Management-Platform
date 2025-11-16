import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
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
import { HasMimeType, IsFile, MaxFileSize, MemoryStoredFile } from 'nestjs-form-data';
import { UnitAvailabilityStatus, UnitType } from '../../../common/enums/unit.enum';

export class CreateUnitDto {
  @ApiProperty({
    example: '673d8b8f123456789abcdef0',
    description: 'ID of the property this unit belongs to',
    required: false,
  })
  @IsOptional()
  @IsString()
  propertyId?: string;

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
    example: 800,
    description: 'Size of the unit',
    minimum: 0,
    required: true,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  size: number;

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
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Media files for the unit',
    required: false,
  })
  @IsOptional()
  @IsFile({ each: true })
  @MaxFileSize(10 * 1024 * 1024, { each: true })
  @HasMimeType(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'video/mp4', 'video/avi'], {
    each: true,
  })
  media_files?: MemoryStoredFile[];

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
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value == 'true')
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
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value == 'true')
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
