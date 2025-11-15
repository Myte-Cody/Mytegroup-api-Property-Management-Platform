import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CreateTransactionDto } from './create-transaction.dto';

export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {
  @ApiPropertyOptional({
    description: 'Date when transaction was paid',
    example: '2024-01-30T10:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paidAt?: Date;
}

export class RefundTransactionDto {
  @ApiPropertyOptional({
    description: 'Refund amount (defaults to full transaction amount)',
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
