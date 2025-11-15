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

export class DeductionItemDto {
  @ApiProperty({
    description: 'Description of the deduction',
    example: 'Carpet cleaning',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @ApiProperty({
    description: 'Cost of the deduction',
    example: 150.0,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost: number;

  @ApiProperty({
    description: 'Notes about the deduction',
    example: 'Professional cleaning required',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ProcessDepositAssessmentDto {
  @ApiProperty({
    description: 'List of deduction items (damages, cleaning, unpaid rent, etc.)',
    type: [DeductionItemDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeductionItemDto)
  deductionItems?: DeductionItemDto[];

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
