import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateStripeConfigDto {
  @ApiProperty({ description: 'Stripe Secret Key (starts with sk_)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^sk_(test|live)_[a-zA-Z0-9]+$/, {
    message: 'Invalid Stripe Secret Key format. Should start with sk_test_ or sk_live_',
  })
  secretKey: string;

  @ApiProperty({ description: 'Stripe Publishable Key (starts with pk_)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^pk_(test|live)_[a-zA-Z0-9]+$/, {
    message: 'Invalid Stripe Publishable Key format. Should start with pk_test_ or pk_live_',
  })
  publishableKey: string;

  @ApiPropertyOptional({ description: 'Stripe Webhook Secret (optional, for handling webhooks)' })
  @IsOptional()
  @IsString()
  webhookSecret?: string;
}

export class StripeConnectStatusDto {
  @ApiProperty({ description: 'Whether Stripe is configured' })
  isConnected: boolean;

  @ApiProperty({ description: 'Configuration status' })
  status: 'not_configured' | 'active' | 'invalid';

  @ApiPropertyOptional({ description: 'Whether charges are enabled' })
  chargesEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Whether payouts are enabled' })
  payoutsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Masked publishable key for display' })
  publishableKey?: string;

  @ApiPropertyOptional({ description: 'When Stripe was configured' })
  configuredAt?: Date;
}

export class PublishableKeyResponseDto {
  @ApiProperty({ description: 'Stripe Publishable Key for frontend' })
  publishableKey: string;
}
