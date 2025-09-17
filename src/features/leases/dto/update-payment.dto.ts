import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CreatePaymentDto } from './create-payment.dto';

export class UpdatePaymentDto extends PartialType(CreatePaymentDto) {
  @ApiPropertyOptional({
    description: 'Date when payment was paid',
    example: '2024-01-30T10:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paidDate?: Date;
}

export class RefundPaymentDto {
  @ApiPropertyOptional({
    description: 'Refund amount (defaults to full payment amount)',
    example: 1200,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  refundAmount?: number;

  @ApiPropertyOptional({
    description: 'Reason for refund',
    example: 'Overpayment correction',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  refundReason?: string;
}
