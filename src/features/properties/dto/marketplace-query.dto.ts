import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { UnitType } from '../../../common/enums/unit.enum';

export class MarketplaceQueryDto {
  @ApiPropertyOptional({
    description: 'Search term to filter units (searches unit number, property name, etc.)',
    example: 'A101',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by unit type',
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
    description: 'Filter by landlord ID to show only units from a specific landlord',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  landlord?: string;
}
