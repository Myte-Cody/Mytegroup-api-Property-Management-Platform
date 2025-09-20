import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentMethod } from '../../../common/enums/lease.enum';

export class MarkPaymentAsPaidDto {
  @ApiProperty({
    description: 'Payment method used',
    enum: PaymentMethod,
    example: PaymentMethod.BANK_TRANSFER,
  })
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Notes about the payment',
    example: 'Payment received via bank transfer',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}