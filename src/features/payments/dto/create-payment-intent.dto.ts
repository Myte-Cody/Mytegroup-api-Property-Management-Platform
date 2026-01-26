import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty } from 'class-validator';

export class CreatePaymentIntentDto {
  @ApiProperty({ description: 'Transaction ID to pay' })
  @IsMongoId({ message: 'Invalid transaction ID format' })
  @IsNotEmpty({ message: 'Transaction ID is required' })
  transactionId: string;
}

export class PaymentIntentResponseDto {
  @ApiProperty({ description: 'Stripe client secret for Payment Element' })
  clientSecret: string;

  @ApiProperty({ description: 'Payment intent ID' })
  paymentIntentId: string;

  @ApiProperty({ description: 'Amount in cents' })
  amount: number;

  @ApiProperty({ description: 'Currency code' })
  currency: string;

  @ApiProperty({ description: 'Stripe publishable key for frontend' })
  publishableKey: string;
}
