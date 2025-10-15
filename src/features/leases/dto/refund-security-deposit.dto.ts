import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefundSecurityDepositDto {
  @ApiProperty({
    description: 'Reason or notes for the security deposit refund',
    example: 'Full refund - no damages found during inspection',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  refundReason: string;
}
