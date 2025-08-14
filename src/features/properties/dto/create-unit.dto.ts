import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
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
    example: 800,
    description: 'Size of the unit',
    minimum: 0,
    required: true,
  })
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
}
