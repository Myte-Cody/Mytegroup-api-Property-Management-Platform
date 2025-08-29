import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { UnitAvailabilityStatus, UnitType } from '../../../common/enums/unit.enum';

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
    example: UnitAvailabilityStatus.AVAILABLE_FOR_RENT,
    description: 'Current availability status of the unit',
    enum: UnitAvailabilityStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(UnitAvailabilityStatus)
  availabilityStatus?: UnitAvailabilityStatus;
}
