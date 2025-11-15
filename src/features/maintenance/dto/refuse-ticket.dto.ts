import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RefuseTicketDto {
  @ApiPropertyOptional({
    description: 'Reason for refusing the ticket',
    maxLength: 1000,
    example: 'Unable to complete due to resource constraints',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  refuseReason?: string;
}
