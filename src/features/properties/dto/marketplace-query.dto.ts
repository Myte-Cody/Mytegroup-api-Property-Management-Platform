import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { UnitType } from '../../../common/enums/unit.enum';

export class MarketplaceQueryDto {
  @ApiPropertyOptional({
    description: 'Search term to filter units (searches property name, unit number, city)',
    example: 'Downtown',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by unit type (apartment type)',
    example: UnitType.STUDIO,
    enum: UnitType,
  })
  @IsOptional()
  @IsEnum(UnitType)
  type?: UnitType;

  @ApiPropertyOptional({
    description: 'Minimum monthly rent',
    example: 500,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minRent?: number;

  @ApiPropertyOptional({
    description: 'Maximum monthly rent',
    example: 2000,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxRent?: number;

  @ApiPropertyOptional({
    description: 'Filter by country',
    example: 'United States',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Filter by city',
    example: 'New York',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Filter to show only units with active availability slots for visits',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  availableForVisits?: boolean;

  @ApiPropertyOptional({
    description: 'Filter to show only recently added units (within last 30 days)',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  recentlyAdded?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by landlord ID to show only units from a specific landlord',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  landlord?: string;
}
