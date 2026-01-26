import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class PaymentSettingsDto {
  @ApiProperty({ description: 'Whether online payments are enabled (master toggle)' })
  onlinePaymentsEnabled: boolean;

  @ApiProperty({ description: 'Whether card payments are accepted' })
  acceptCardPayments: boolean;
}

export class UpdatePaymentSettingsDto {
  @ApiPropertyOptional({ description: 'Enable/disable online payments' })
  @IsOptional()
  @IsBoolean()
  onlinePaymentsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable/disable card payments' })
  @IsOptional()
  @IsBoolean()
  acceptCardPayments?: boolean;
}
