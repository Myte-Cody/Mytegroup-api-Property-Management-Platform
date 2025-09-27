import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class DamageItemDto {
  @ApiProperty({
    description: 'Description of the damage',
    example: 'Carpet stains in living room',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @ApiProperty({
    description: 'Cost to repair the damage',
    example: 150.0,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost: number;

  @ApiProperty({
    description: 'Notes about the damage',
    example: 'Red wine stains, professional cleaning required',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ProcessDepositAssessmentDto {
  @ApiProperty({
    description: 'List of damage items found during inspection',
    type: [DamageItemDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DamageItemDto)
  damageItems?: DamageItemDto[];

  @ApiProperty({
    description: 'Cleaning costs deducted from deposit',
    example: 100.0,
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cleaningCosts?: number;

  @ApiProperty({
    description: 'Outstanding unpaid rent',
    example: 0,
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unpaidRent?: number;

  @ApiProperty({
    description: 'Other charges or fees',
    example: 50.0,
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  otherCharges?: number;

  @ApiProperty({
    description: 'Notes about the assessment',
    example: 'Unit was in good condition overall, minor cleaning required',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  assessmentNotes?: string;

  @ApiProperty({
    description: 'Final refund amount after deductions',
    example: 450.0,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  finalRefundAmount: number;

  @ApiProperty({
    description: 'Reason for refund processing',
    example: 'Inspection completed - partial refund due to cleaning costs',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  refundReason: string;
}
